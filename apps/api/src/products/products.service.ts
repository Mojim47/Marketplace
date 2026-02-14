import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';

type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

// Forward reference to avoid circular dependency
interface ProductSearchServiceInterface {
  indexProduct(product: {
    id: string;
    name: string;
    description?: string;
    price: number;
    salePrice?: number;
    categoryId?: string;
    vendorId?: string;
    stock: number;
    status: string;
    images?: string[];
    rating?: number;
  }): Promise<void>;
  removeFromIndex(productId: string): Promise<void>;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject('PRODUCT_SEARCH_SERVICE')
    private readonly searchService?: ProductSearchServiceInterface
  ) {}

  async create(vendorId: string, data: Record<string, unknown>) {
    // Ensure required fields are present
    const productData = {
      name: data.name as string,
      slug: (data.slug as string) || (data.name as string).toLowerCase().replace(/\s+/g, '-'),
      sku: (data.sku as string) || `SKU-${Date.now()}`,
      price: data.price as number,
      description: (data.description as string) || '',
      stock: (data.stock as number) || 0,
      ...data,
      vendor: { connect: { id: vendorId } },
      status: 'DRAFT' as const,
    };

    const product = await this.prisma.product.create({
      data: productData as any,
      include: { category: true, vendor: { select: { businessName: true } } },
    });

    // Index product in search (Requirements: 8.1)
    if (this.searchService && product.status === 'ACTIVE') {
      await this.searchService.indexProduct({
        id: product.id,
        name: product.name,
        description: product.description || undefined,
        price: product.price.toNumber(),
        salePrice: product.salePrice?.toNumber(),
        categoryId: product.categoryId || undefined,
        vendorId: product.vendorId,
        stock: product.stock,
        status: product.status,
        images: product.images as string[] | undefined,
        rating: product.rating?.toNumber(),
      });
    }

    return product;
  }

  async findAll(filters?: { status?: ProductStatus; categoryId?: string; search?: string }) {
    const search = filters?.search?.trim();
    return this.prisma.product.findMany({
      where: {
        status: filters?.status || 'ACTIVE',
        categoryId: filters?.categoryId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { search_vector: { search } },
          ],
        }),
      },
      include: {
        vendor: { select: { businessName: true, rating: true } },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        vendor: true,
        category: true,
        variants: true,
        reviews: { where: { status: 'approved' }, take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!product) {
      throw new NotFoundException('محصول يافت نشد');
    }
    return product;
  }

  async update(id: string, vendorId: string, data: Record<string, unknown>) {
    const product = await this.prisma.product.findFirst({ where: { id, vendorId } });
    if (!product) {
      throw new NotFoundException('محصول يافت نشد يا دسترسي نداريد');
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });

    // Update search index (Requirements: 8.1)
    if (this.searchService) {
      if (updatedProduct.status === 'ACTIVE') {
        await this.searchService.indexProduct({
          id: updatedProduct.id,
          name: updatedProduct.name,
          description: updatedProduct.description || undefined,
          price: updatedProduct.price.toNumber(),
          salePrice: updatedProduct.salePrice?.toNumber(),
          categoryId: updatedProduct.categoryId || undefined,
          vendorId: updatedProduct.vendorId,
          stock: updatedProduct.stock,
          status: updatedProduct.status,
          images: updatedProduct.images as string[] | undefined,
          rating: updatedProduct.rating?.toNumber(),
        });
      } else {
        // Remove from index if not active
        await this.searchService.removeFromIndex(id);
      }
    }

    return updatedProduct;
  }

  async delete(id: string, vendorId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, vendorId } });
    if (!product) {
      throw new NotFoundException('محصول يافت نشد يا دسترسي نداريد');
    }

    // Remove from search index (Requirements: 8.1)
    if (this.searchService) {
      await this.searchService.removeFromIndex(id);
    }

    return this.prisma.product.delete({ where: { id } });
  }

  async updateStock(id: string, quantity: number) {
    if (quantity < 0) {
      throw new BadRequestException('موجودي نميتواند منفي باشد');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: { stock: quantity },
    });

    // Update search index for stock change (Requirements: 8.1)
    if (this.searchService && product.status === 'ACTIVE') {
      await this.searchService.indexProduct({
        id: product.id,
        name: product.name,
        description: product.description || undefined,
        price: product.price.toNumber(),
        salePrice: product.salePrice?.toNumber(),
        categoryId: product.categoryId || undefined,
        vendorId: product.vendorId,
        stock: product.stock,
        status: product.status,
        images: product.images as string[] | undefined,
        rating: product.rating?.toNumber(),
      });
    }

    return product;
  }
}
