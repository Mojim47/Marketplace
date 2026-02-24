import { type TaxonomyNode, aimarketTaxonomy } from '@/lib/aimarket-taxonomy';
import { prisma } from '@/lib/prisma-server';
import { isStrictProdPolicyEnabled } from '@/lib/runtime-policy';

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isFeatured: boolean;
  children: CategoryNode[];
};

function mapTaxonomyNode(node: TaxonomyNode, parentId: string | null): CategoryNode {
  const id = `fallback:${node.key}`;
  return {
    id,
    name: node.name,
    slug: node.slug,
    description: node.description,
    parentId,
    level: node.level,
    sortOrder: node.sortOrder,
    isFeatured: node.isFeatured,
    children: (node.children ?? []).map((child) => mapTaxonomyNode(child, id)),
  };
}

function fallbackTree(options?: {
  group?: string | null;
  level?: string | null;
  q?: string | null;
}): CategoryNode[] {
  const mapped = aimarketTaxonomy.map((node) => mapTaxonomyNode(node, null));
  const q = (options?.q ?? '').trim().toLowerCase();

  const walkFilter = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes
      .map((node) => ({ ...node, children: walkFilter(node.children) }))
      .filter((node) => {
        const hay = `${node.name} ${node.slug} ${node.description ?? ''}`.toLowerCase();
        const matchesQ = q.length === 0 || hay.includes(q);
        const matchesGroup =
          !options?.group ||
          node.slug === options.group ||
          node.children.some((child) => child.slug === options.group);
        const matchesLevel = !options?.level || node.slug === options.level;
        return matchesQ && matchesGroup && matchesLevel ? true : node.children.length > 0;
      });

  return walkFilter(mapped);
}

export async function listCategoryTree(options?: {
  group?: string | null;
  level?: string | null;
  q?: string | null;
}): Promise<CategoryNode[]> {
  try {
    const categoryClient = (prisma as any).category;
    const rows: any[] = await categoryClient.findMany({
      where: {
        ...(options?.group
          ? {
              OR: [{ slug: options.group }, { parent: { slug: options.group } }],
            }
          : {}),
        ...(options?.level ? { slug: options.level } : {}),
        ...(options?.q
          ? {
              OR: [
                { name: { contains: options.q, mode: 'insensitive' } },
                { slug: { contains: options.q, mode: 'insensitive' } },
                { description: { contains: options.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ level: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parent_id: true,
        level: true,
        sort_order: true,
        is_featured: true,
      },
    });

    const byId = new Map<string, CategoryNode>();
    for (const row of rows) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        parentId: row.parent_id,
        level: row.level,
        sortOrder: row.sort_order,
        isFeatured: row.is_featured,
        children: [],
      });
    }

    const roots: CategoryNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortTree = (nodes: CategoryNode[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      for (const node of nodes) {
        sortTree(node.children);
      }
    };

    sortTree(roots);
    return roots;
  } catch {
    if (isStrictProdPolicyEnabled()) {
      throw new Error('category_db_unavailable_strict_mode');
    }
    return fallbackTree(options);
  }
}

export async function getCategoryBySlug(slug: string): Promise<CategoryNode | null> {
  try {
    const categoryClient = (prisma as any).category;
    const category: any = await categoryClient.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parent_id: true,
        level: true,
        sort_order: true,
        is_featured: true,
        children: {
          orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            parent_id: true,
            level: true,
            sort_order: true,
            is_featured: true,
            children: {
              orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                parent_id: true,
                level: true,
                sort_order: true,
                is_featured: true,
              },
            },
          },
        },
      },
    });

    if (!category) {
      return null;
    }

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parent_id,
      level: category.level,
      sortOrder: category.sort_order,
      isFeatured: category.is_featured,
      children: category.children.map((child: any) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        description: child.description,
        parentId: child.parent_id,
        level: child.level,
        sortOrder: child.sort_order,
        isFeatured: child.is_featured,
        children: child.children.map((g: any) => ({
          id: g.id,
          name: g.name,
          slug: g.slug,
          description: g.description,
          parentId: g.parent_id,
          level: g.level,
          sortOrder: g.sort_order,
          isFeatured: g.is_featured,
          children: [],
        })),
      })),
    };
  } catch {
    if (isStrictProdPolicyEnabled()) {
      throw new Error('category_db_unavailable_strict_mode');
    }
    const all = fallbackTree();
    const stack = [...all];
    while (stack.length > 0) {
      const current = stack.shift() as CategoryNode;
      if (current.slug === slug) {
        return current;
      }
      stack.push(...current.children);
    }
    return null;
  }
}
