import { CategorySearchExperience } from '@/components/CategorySearchExperience';
import { Container } from '@/components/ui';
import { CATALOG_PRODUCTS } from '@/lib/catalog-data';
import { listCategoryTree } from '@/lib/categories';

type CategoriesPageProps = {
  searchParams?: Promise<{
    q?: string;
    group?: string;
    level?: string;
  }>;
};

export const dynamic = 'force-dynamic';

function flatten(
  nodes: Awaited<ReturnType<typeof listCategoryTree>>
): Awaited<ReturnType<typeof listCategoryTree>> {
  const out: Awaited<ReturnType<typeof listCategoryTree>> = [];

  const walk = (items: typeof nodes) => {
    for (const item of items) {
      out.push(item);
      if (item.children.length > 0) {
        walk(item.children);
      }
    }
  };

  walk(nodes);
  return out;
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const resolved = (await searchParams) ?? {};
  const q = resolved.q?.trim() ?? '';
  const group = resolved.group?.trim() ?? '';
  const level = resolved.level?.trim() ?? '';

  const tree = await listCategoryTree({
    q: q || null,
    group: group || null,
    level: level || null,
  });

  const cards = flatten(tree).filter((item) => item.level === 1 || item.level === 2);

  return (
    <Container className="py-12">
      <CategorySearchExperience
        cards={cards}
        products={CATALOG_PRODUCTS}
        initialQuery={q}
        initialGroup={group && group !== 'all' ? group : ''}
        initialLevel={level}
      />
    </Container>
  );
}
