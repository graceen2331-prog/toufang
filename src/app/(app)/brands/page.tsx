"use client";

import { useState } from "react";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BrandFormDialog } from "@/features/brands/components/brand-form-dialog";
import { ProductFormDialog } from "@/features/products/components/product-form-dialog";
import { useBrands, useDeleteBrand } from "@/features/brands/queries";
import { useDeleteProduct, useProducts } from "@/features/products/queries";
import type { BrandDto } from "@/shared/schemas/brand";
import type { ProductDto } from "@/shared/schemas/product";

export default function BrandsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">品牌与产品</h1>
        <p className="text-sm text-muted-foreground">
          品牌规范、禁用词与产品卖点是 AI 策略、Brief 与内容审核的基础输入。
        </p>
      </div>
      <Tabs defaultValue="brands">
        <TabsList>
          <TabsTrigger value="brands">品牌</TabsTrigger>
          <TabsTrigger value="products">产品</TabsTrigger>
        </TabsList>
        <TabsContent value="brands" className="mt-4">
          <BrandsTab />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <ProductsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BrandsTab() {
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrandDto | null>(null);
  const { data, isLoading, isError, refetch } = useBrands({ q });
  const deleteBrand = useDeleteBrand();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-64">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索品牌"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          新建品牌
        </Button>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            品牌列表加载失败。
            <Button variant="link" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <TableSkeleton cols={5} />
      ) : data && data.items.length === 0 ? (
        <EmptyHint
          title={q ? "没有匹配的品牌" : "还没有品牌"}
          hint={q ? "换个关键词试试" : "点击右上角「新建品牌」开始"}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>品牌</TableHead>
                <TableHead>行业</TableHead>
                <TableHead>目标市场</TableHead>
                <TableHead className="text-right">产品数</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell>
                    <div className="font-medium">{brand.name}</div>
                    <div className="text-xs text-muted-foreground">{brand.slug}</div>
                  </TableCell>
                  <TableCell>{brand.industry ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {brand.markets.length > 0 ? (
                        brand.markets.map((m) => (
                          <Badge key={m} variant="secondary">
                            {m}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brand.product_count ?? 0}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(brand);
                            setDialogOpen(true);
                          }}
                        >
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            if (window.confirm(`确认删除品牌「${brand.name}」？`)) {
                              deleteBrand.mutate(brand.id);
                            }
                          }}
                        >
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <BrandFormDialog open={dialogOpen} onOpenChange={setDialogOpen} brand={editing} />
    </div>
  );
}

function ProductsTab() {
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDto | null>(null);
  const { data: brandsData } = useBrands();
  const { data, isLoading, isError, refetch } = useProducts({ q });
  const deleteProduct = useDeleteProduct();
  const brands = brandsData?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-64">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索产品"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button
          disabled={brands.length === 0}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          新建产品
        </Button>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            产品列表加载失败。
            <Button variant="link" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <TableSkeleton cols={5} />
      ) : data && data.items.length === 0 ? (
        <EmptyHint
          title={q ? "没有匹配的产品" : "还没有产品"}
          hint={
            brands.length === 0 ? "请先在「品牌」标签页创建品牌" : "点击右上角「新建产品」开始"
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>产品</TableHead>
                <TableHead>品牌</TableHead>
                <TableHead>品类</TableHead>
                <TableHead>核心卖点</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.brand_name ?? "—"}</TableCell>
                  <TableCell>{product.category ?? "—"}</TableCell>
                  <TableCell className="max-w-64">
                    <div className="flex flex-wrap gap-1">
                      {product.key_claims.slice(0, 3).map((c) => (
                        <Badge key={c} variant="outline">
                          {c}
                        </Badge>
                      ))}
                      {product.key_claims.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{product.key_claims.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(product);
                            setDialogOpen(true);
                          }}
                        >
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            if (window.confirm(`确认删除产品「${product.name}」？`)) {
                              deleteProduct.mutate(product.id);
                            }
                          }}
                        >
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        brands={brands}
      />
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyHint({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
