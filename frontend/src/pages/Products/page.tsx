import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Search,
  Plus,
  Link as LinkIcon,
  Edit2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Boxes,
  Store,
  X,
  Trash2,
  Layers,
  ListFilter,
  Sparkles,
  FileSpreadsheet,
  History,
  MoreHorizontal,
  Eye,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Barcode,
  SlidersHorizontal,
} from 'lucide-react';
import { productsApi } from '../../services/productsApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { formatCurrency, parseExcelFile } from '../../utils';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import {
  SystemPagination,
  SystemTableWrapper,
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
  SystemTableSkeleton,
  SystemTableEmpty,
} from '../../components/ui/SystemTable';
import { Button } from '../../components/ui/Button';
import { ProductHistoryModal } from '../../components/products/ProductHistoryModal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui/DropdownMenu';
import { toast } from '../../components/ui/Toast';

const generateSkuFromName = (name: string): string => {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';

  const noAccents = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();

  const cleanStr = noAccents.replace(/[^A-Z0-9\s]/g, ' ').trim();
  const words = cleanStr.split(/\s+/).filter(Boolean);

  if (words.length === 0) return '';

  if (words.length <= 2) {
    return words.join('-');
  }

  const totalLen = words.reduce((acc, w) => acc + w.length, 0);
  if (words.length <= 4 && totalLen <= 14) {
    return words.join('-');
  }

  const acronym = words.map((w) => w[0]).join('');
  if (acronym.length >= 3 && acronym.length <= 8) {
    return acronym;
  }

  return words.slice(0, 3).join('-');
};

interface VariantItem {
  sku: string;
  name: string;
  barcode: string;
  costPrice: number;
  sellPrice: number;
  minStockAlert: number;
}

export const ProductsPage: React.FC = () => {
  const { selectedShopId, shops } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'MAPPINGS'>('PRODUCTS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);

  // Mappings state
  const [mappings, setMappings] = useState<any[]>([]);
  const [isLoadingMappings, setIsLoadingMappings] = useState<boolean>(false);
  const [mappingShopFilter, setMappingShopFilter] = useState<string>(
    selectedShopId !== 'ALL' ? selectedShopId : ''
  );

  // Modals
  const [isCreateProductModalOpen, setIsCreateProductModalOpen] = useState<boolean>(false);
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState<boolean>(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<any>(null);
  const [editProductForm, setEditProductForm] = useState({ name: '', description: '' });

  const [isDeleteProductModalOpen, setIsDeleteProductModalOpen] = useState<boolean>(false);
  const [selectedProductForDelete, setSelectedProductForDelete] = useState<any>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState<boolean>(false);

  const [isEditVariantModalOpen, setIsEditVariantModalOpen] = useState<boolean>(false);
  const [selectedVariantForEdit, setSelectedVariantForEdit] = useState<any>(null);
  const [isDeleteVariantModalOpen, setIsDeleteVariantModalOpen] = useState<boolean>(false);
  const [selectedVariantForDelete, setSelectedVariantForDelete] = useState<any>(null);
  const [isDeletingVariant, setIsDeletingVariant] = useState<boolean>(false);

  // Stock History Modal
  const [selectedVariantForHistory, setSelectedVariantForHistory] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Shopee Variants Detail Modal for internal variant
  const [isShopeeVariantsModalOpen, setIsShopeeVariantsModalOpen] = useState<boolean>(false);
  const [selectedProductForShopee, setSelectedProductForShopee] = useState<any>(null);
  const [selectedVariantForShopee, setSelectedVariantForShopee] = useState<any>(null);

  // Product Detail Modal (View internal product & its Shopee variants)
  const [isProductDetailModalOpen, setIsProductDetailModalOpen] = useState<boolean>(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<any>(null);

  // Inline expanded Shopee variants state
  const [expandedVariantShopeeIds, setExpandedVariantShopeeIds] = useState<string[]>([]);
  const [isAllShopeeVariantsExpanded, setIsAllShopeeVariantsExpanded] = useState<boolean>(false);

  // Quick link Shopee variant inside modal
  const [isAddShopeeLinkOpen, setIsAddShopeeLinkOpen] = useState<boolean>(false);
  const [selectedShopeeListingToAdd, setSelectedShopeeListingToAdd] = useState<string>('');
  const [addShopeeLinkMultiplier, setAddShopeeLinkMultiplier] = useState<number>(1);

  // Mapping status filter for Tab 1 ('ALL' | 'MAPPED' | 'UNMAPPED')
  const [mappingStatusFilter, setMappingStatusFilter] = useState<string>('ALL');

  const [isMapModalOpen, setIsMapModalOpen] = useState<boolean>(false);
  const [selectedMappingTarget, setSelectedMappingTarget] = useState<any>(null);
  const variantFileInputRef = useRef<HTMLInputElement | null>(null);

  // Form states
  const [createProductForm, setCreateProductForm] = useState<{
    name: string;
    sku: string;
    description: string;
    variants: VariantItem[];
  }>({
    name: '',
    sku: '',
    description: '',
    variants: [
      {
        sku: '',
        name: 'Mặc định',
        barcode: '',
        costPrice: 0,
        sellPrice: 0,
        minStockAlert: 5,
      },
    ],
  });

  const [editVariantForm, setEditVariantForm] = useState({
    name: '',
    barcode: '',
    costPrice: 0,
    sellPrice: 0,
    minStockAlert: 5,
  });

  const [selectedInternalVariantId, setSelectedInternalVariantId] = useState<string>('');
  const [mappingExternalSku, setMappingExternalSku] = useState<string>('');
  const [mappingMultiplier, setMappingMultiplier] = useState<number>(1);

  // Advanced Mapping & Grouping States
  const [mappingViewMode, setMappingViewMode] = useState<'LIST' | 'GROUPED'>('LIST');
  const [mappingSearchTerm, setMappingSearchTerm] = useState<string>('');
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);
  const [isBulkMapModalOpen, setIsBulkMapModalOpen] = useState<boolean>(false);
  const [bulkMapTargetVariantId, setBulkMapTargetVariantId] = useState<string>('');
  const [bulkMultipliers, setBulkMultipliers] = useState<Record<string, number>>({});

  // Pagination for Mappings
  const [mappingPage, setMappingPage] = useState<number>(1);
  const [mappingLimit, setMappingLimit] = useState<number>(25);

  // Quick Create Variant in Mapping Modal
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState<boolean>(false);
  const [isCreatingQuickVariant, setIsCreatingQuickVariant] = useState<boolean>(false);
  const [quickCreateForm, setQuickCreateForm] = useState({
    name: '',
    sku: '',
    variantName: 'Mặc định',
    costPrice: 0,
    sellPrice: 0,
  });

  const handleQuickCreateVariant = async (e?: React.FormEvent) => {
    e?.preventDefault?.();
    if (!quickCreateForm.name?.trim() || !quickCreateForm.sku?.trim()) {
      toast.warning('Vui lòng nhập tên sản phẩm và mã SKU nội bộ');
      return;
    }
    setIsCreatingQuickVariant(true);
    try {
      const skuClean = quickCreateForm.sku.trim().toUpperCase();
      const variantNameClean = quickCreateForm.variantName?.trim() || 'Mặc định';
      const newProduct: any = await productsApi.create({
        name: quickCreateForm.name.trim(),
        sku: skuClean,
        variants: [
          {
            sku: skuClean,
            name: variantNameClean,
            costPrice: Number(quickCreateForm.costPrice) || 0,
            sellPrice: Number(quickCreateForm.sellPrice) || 0,
            minStockAlert: 5,
          },
        ],
      });
      await loadProducts();
      await loadAllVariants();
      const createdVariant = newProduct?.variants?.[0];
      if (createdVariant?.id) {
        setSelectedInternalVariantId(createdVariant.id);
      }
      setIsQuickCreateOpen(false);
      toast.success('Tạo nhanh biến thể thành công!', `Mã SKU: ${skuClean}`);
    } catch (err: any) {
      toast.error('Lỗi tạo nhanh biến thể', err.message);
    } finally {
      setIsCreatingQuickVariant(false);
    }
  };

  const [allInternalVariantsList, setAllInternalVariantsList] = useState<any[]>([]);

  const loadAllVariants = async () => {
    try {
      const res: any = await productsApi.findAllVariants({ limit: 1000 });
      const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
      setAllInternalVariantsList(
        items.map((v: any) => ({
          id: v.id,
          productName: v.product?.name || v.productName || 'Sản phẩm',
          variantName: v.name || 'Mặc định',
          sku: v.sku || '',
          barcode: v.barcode || '',
          unit: v.unit || 'cái',
          costPrice: Number(v.costPrice) || 0,
        }))
      );
    } catch (err) {
      console.error('Error loading all variants:', err);
    }
  };

  // Load Products
  useEffect(() => {
    if (activeTab === 'PRODUCTS') {
      loadProducts();
    }
    loadAllVariants();
  }, [activeTab, page, limit, searchTerm]);

  // Load Mappings
  useEffect(() => {
    if (activeTab === 'MAPPINGS') {
      loadMappings();
      loadAllVariants();
    }
  }, [activeTab, mappingShopFilter, selectedShopId]);

  const loadProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const params: any = { page, limit };
      if (searchTerm && searchTerm.trim() !== '') {
        params.search = searchTerm.trim();
      }
      const res: any = await productsApi.findAll(params);
      const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
      const total = res?.total ?? res?.meta?.total ?? items.length;
      setProducts(items);
      setTotalProducts(total);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const loadMappings = async () => {
    setIsLoadingMappings(true);
    try {
      const targetShopId =
        mappingShopFilter || (selectedShopId !== 'ALL' ? selectedShopId : undefined);
      const res: any = await productsApi.findMappings(targetShopId);
      setMappings(res || []);
    } catch (err) {
      console.error('Error loading mappings:', err);
    } finally {
      setIsLoadingMappings(false);
    }
  };

  // Generate auto product & SKU code
  const generateNextProductCode = () => {
    const nextSeq = (totalProducts || products.length) + 1;
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `SP${yy}${mm}-${String(nextSeq).padStart(3, '0')}`;
  };

  const handleOpenCreateProductModal = () => {
    const autoCode = generateNextProductCode();
    setCreateProductForm({
      name: '',
      sku: autoCode,
      description: '',
      variants: [
        {
          sku: `${autoCode}-1`,
          name: 'Mặc định',
          barcode: '',
          costPrice: 0,
          sellPrice: 0,
          minStockAlert: 5,
        },
      ],
    });
    setIsCreateProductModalOpen(true);
  };

  // Create Product Handlers
  const handleProductNameChange = (newName: string) => {
    const nameSku = generateSkuFromName(newName);
    const prevNameSku = generateSkuFromName(createProductForm.name);
    const isAuto =
      !createProductForm.sku ||
      createProductForm.sku === prevNameSku ||
      createProductForm.sku.startsWith('SP');

    const newSku = isAuto && nameSku ? nameSku : (createProductForm.sku || generateNextProductCode());

    const updatedVariants = createProductForm.variants.map((v, i) => {
      const suffix = createProductForm.variants.length > 1 ? `-${i + 1}` : '-1';
      return {
        ...v,
        sku: `${newSku}${suffix}`,
      };
    });

    setCreateProductForm((prev) => ({
      ...prev,
      name: newName,
      sku: newSku,
      variants: updatedVariants,
    }));
  };

  const handleRegenerateSku = () => {
    const generatedSku = generateSkuFromName(createProductForm.name) || generateNextProductCode();
    setCreateProductForm((prev) => ({
      ...prev,
      sku: generatedSku,
      variants: prev.variants.map((v, i) => ({
        ...v,
        sku: `${generatedSku}-${i + 1}`,
      })),
    }));
  };

  const handleAddVariantField = () => {
    const baseSku = createProductForm.sku || 'SKU';
    const nextIdx = createProductForm.variants.length + 1;
    setCreateProductForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          sku: `${baseSku}-${nextIdx}`,
          name: `Biến thể ${nextIdx}`,
          barcode: '',
          costPrice: 0,
          sellPrice: 0,
          minStockAlert: 5,
        },
      ],
    }));
  };

  const handleRemoveVariantField = (idxToRemove: number) => {
    setCreateProductForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, idx) => idx !== idxToRemove),
    }));
  };

  const handleImportVariantsFromExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows: any[] = await parseExcelFile(file);
      if (!rows || rows.length === 0) {
        alert('File Excel không có dữ liệu.');
        return;
      }

      const extractedVariants: VariantItem[] = [];
      const seenKeys = new Set<string>();
      const parentSku =
        createProductForm.sku || generateSkuFromName(createProductForm.name) || 'SKU';

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const varName =
          row['Tên phân loại hàng'] ||
          row['Phân loại hàng'] ||
          row['Phân loại'] ||
          row['Tên phân loại'] ||
          row['Variation Name'] ||
          row['Biến thể'] ||
          row['Tên biến thể'] ||
          row['Tên phân loại hàng hóa'] ||
          '';

        const rawSku =
          row['SKU phân loại'] ||
          row['Mã SKU'] ||
          row['SKU'] ||
          row['Seller SKU'] ||
          row['Mã phân loại'] ||
          '';

        const rawPrice =
          row['Giá gốc'] ||
          row['Giá bán'] ||
          row['Giá'] ||
          row['Price'] ||
          row['Deal Price'] ||
          0;

        const rawBarcode = row['Mã vạch'] || row['Barcode'] || '';
        const rawCost = row['Giá vốn'] || row['Cost Price'] || row['Giá nhập'] || 0;

        const cleanVarName = String(varName || '').trim();
        const cleanSku = String(rawSku || '').trim();

        if (!cleanVarName && !cleanSku) continue;

        const dedupeKey = `${cleanVarName}_${cleanSku}`.toLowerCase();
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);

        const skuSuffix = cleanVarName
          ? generateSkuFromName(cleanVarName)
          : `${extractedVariants.length + 1}`;
        const finalSku = cleanSku
          ? cleanSku.toUpperCase()
          : `${parentSku}-${skuSuffix}`;

        extractedVariants.push({
          name: cleanVarName || `Phân loại ${extractedVariants.length + 1}`,
          sku: finalSku,
          barcode: String(rawBarcode || '').trim(),
          costPrice: parseFloat(String(rawCost).replace(/,/g, '')) || 0,
          sellPrice: parseFloat(String(rawPrice).replace(/,/g, '')) || 0,
          minStockAlert: 5,
        });
      }

      if (extractedVariants.length === 0) {
        alert(
          'Không tìm thấy cột phân loại (như "Tên phân loại hàng", "SKU phân loại"...) trong file Excel.'
        );
        return;
      }

      setCreateProductForm((prev) => ({
        ...prev,
        variants: extractedVariants,
      }));

      alert(`Đã nạp thành công ${extractedVariants.length} biến thể từ file Excel!`);
    } catch (err: any) {
      console.error('Error importing variants from Excel:', err);
      alert(`Lỗi khi đọc file Excel: ${err.message}`);
    } finally {
      if (variantFileInputRef.current) {
        variantFileInputRef.current.value = '';
      }
    }
  };

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createProductForm.name.trim() || !createProductForm.sku.trim()) {
      alert('Vui lòng nhập tên sản phẩm và mã SKU sản phẩm cha');
      return;
    }

    const variantsToSubmit =
      createProductForm.variants.length > 0
        ? createProductForm.variants
        : [
            {
              sku: `${createProductForm.sku}-1`,
              name: 'Mặc định',
              barcode: '',
              costPrice: 0,
              sellPrice: 0,
              minStockAlert: 5,
            },
          ];

    try {
      await productsApi.create({
        code: createProductForm.sku,
        name: createProductForm.name,
        description: createProductForm.description || undefined,
        variants: variantsToSubmit.map((v) => ({
          sku: v.sku,
          name: v.name,
          barcode: v.barcode || undefined,
          costPrice: parseFloat(String(v.costPrice)) || 0,
          sellingPrice: parseFloat(String(v.sellPrice)) || 0,
          lowStockThreshold: parseInt(String(v.minStockAlert), 10) || 5,
        })),
      });
      setIsCreateProductModalOpen(false);
      setCreateProductForm({
        name: '',
        sku: '',
        description: '',
        variants: [
          {
            sku: '',
            name: 'Mặc định',
            barcode: '',
            costPrice: 0,
            sellPrice: 0,
            minStockAlert: 5,
          },
        ],
      });
      loadProducts();
      await loadAllVariants();
      toast.success('Tạo sản phẩm thành công!', `Mã sản phẩm: ${createProductForm.sku}`);
    } catch (err: any) {
      toast.error('Lỗi tạo sản phẩm', err.message);
    }
  };

  // Edit Variant Handlers
  const handleOpenEditVariant = (variant: any) => {
    setSelectedVariantForEdit(variant);
    setEditVariantForm({
      name: variant.name || '',
      barcode: variant.barcode || '',
      costPrice: variant.costPrice || 0,
      sellPrice: variant.sellingPrice ?? variant.sellPrice ?? 0,
      minStockAlert: variant.lowStockThreshold ?? variant.minStockAlert ?? 5,
    });
    setIsEditVariantModalOpen(true);
  };

  const handleUpdateVariantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantForEdit) return;
    try {
      await productsApi.updateVariant(selectedVariantForEdit.id, editVariantForm);
      setIsEditVariantModalOpen(false);
      loadProducts();
      await loadAllVariants();
      toast.success('Cập nhật biến thể thành công!');
    } catch (err: any) {
      toast.error('Lỗi cập nhật biến thể', err.message);
    }
  };

  // Edit & Delete Product (Parent) Handlers
  const handleOpenEditProduct = (product: any) => {
    setSelectedProductForEdit(product);
    setEditProductForm({
      name: product.name || '',
      description: product.description || '',
    });
    setIsEditProductModalOpen(true);
  };

  const handleUpdateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForEdit) return;
    try {
      await productsApi.update(selectedProductForEdit.id, {
        name: editProductForm.name.trim(),
        description: editProductForm.description.trim() || undefined,
      });
      setIsEditProductModalOpen(false);
      loadProducts();
      await loadAllVariants();
      toast.success('Cập nhật sản phẩm thành công!');
    } catch (err: any) {
      toast.error('Lỗi cập nhật sản phẩm', err.message || 'Không thể cập nhật');
    }
  };

  const handleOpenDeleteProduct = (product: any) => {
    setSelectedProductForDelete(product);
    setIsDeleteProductModalOpen(true);
  };

  const handleDeleteProductSubmit = async () => {
    if (!selectedProductForDelete) return;
    setIsDeletingProduct(true);
    try {
      await productsApi.delete(selectedProductForDelete.id);
      setIsDeleteProductModalOpen(false);
      setSelectedProductForDelete(null);
      loadProducts();
      await loadAllVariants();
      toast.success('Đã xóa sản phẩm thành công!');
    } catch (err: any) {
      toast.error('Lỗi xóa sản phẩm', err.message || 'Không thể xóa');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // Delete Variant Handlers
  const handleOpenDeleteVariant = (variant: any) => {
    setSelectedVariantForDelete(variant);
    setIsDeleteVariantModalOpen(true);
  };

  const handleDeleteVariantSubmit = async () => {
    if (!selectedVariantForDelete) return;
    setIsDeletingVariant(true);
    try {
      await productsApi.deleteVariant(selectedVariantForDelete.id);
      setIsDeleteVariantModalOpen(false);
      setSelectedVariantForDelete(null);
      loadProducts();
      await loadAllVariants();
      toast.success('Đã xóa biến thể thành công!');
    } catch (err: any) {
      toast.error('Lỗi xóa biến thể', err.message || 'Không thể xóa');
    } finally {
      setIsDeletingVariant(false);
    }
  };

  const handleOpenProductDetail = (product: any) => {
    setSelectedProductForDetail(product);
    setIsProductDetailModalOpen(true);
  };

  const toggleExpandVariantShopee = (variantId: string) => {
    setExpandedVariantShopeeIds((prev) =>
      prev.includes(variantId) ? prev.filter((id) => id !== variantId) : [...prev, variantId]
    );
  };

  const handleToggleExpandAllShopee = () => {
    if (isAllShopeeVariantsExpanded) {
      setExpandedVariantShopeeIds([]);
      setIsAllShopeeVariantsExpanded(false);
    } else {
      const allIds = products.flatMap((p) => (p.variants || []).map((v: any) => v.id));
      setExpandedVariantShopeeIds(allIds);
      setIsAllShopeeVariantsExpanded(true);
    }
  };

  const handleAddShopeeLinkDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopeeListingToAdd || !selectedVariantForShopee) {
      toast.warning('Vui lòng chọn sản phẩm / phân loại Shopee cần liên kết');
      return;
    }
    const item = mappings.find((m) => m.id === selectedShopeeListingToAdd);
    if (!item) {
      toast.error('Không tìm thấy thông tin sản phẩm Shopee đã chọn');
      return;
    }

    try {
      const created: any = await productsApi.createMapping({
        shopId: item.shopId,
        variantId: selectedVariantForShopee.id,
        sellerSku: item.sellerSku || item.externalSku || '',
        productName: item.productName || item.listingName,
        variationName: item.variationName,
        multiplier: Math.max(1, parseInt(String(addShopeeLinkMultiplier), 10) || 1),
      });

      toast.success('Đã liên kết biến thể Shopee thành công!');
      setIsAddShopeeLinkOpen(false);
      setSelectedShopeeListingToAdd('');
      setAddShopeeLinkMultiplier(1);

      setSelectedVariantForShopee((prev: any) => {
        const currentMappings = prev.listingMappings || [];
        const updatedItem = {
          ...item,
          id: created?.id || item.id,
          multiplier: Math.max(1, parseInt(String(addShopeeLinkMultiplier), 10) || 1),
          shop: item.shop || { code: item.shopId, name: item.shopId },
        };
        return {
          ...prev,
          listingMappings: [
            ...currentMappings.filter((m: any) => m.id !== updatedItem.id),
            updatedItem,
          ],
        };
      });

      loadProducts();
      loadMappings();
    } catch (err: any) {
      toast.error('Lỗi liên kết Shopee', err.message);
    }
  };

  const handleOpenShopeeVariantsModal = (product: any, variant: any) => {
    setSelectedProductForShopee(product);
    setSelectedVariantForShopee(variant);
    setIsShopeeVariantsModalOpen(true);
    setIsAddShopeeLinkOpen(false);
    setSelectedShopeeListingToAdd('');
    setAddShopeeLinkMultiplier(1);
  };

  // Mapping Handlers
  const handleOpenMapModal = (shopeeItem: any) => {
    setSelectedMappingTarget(shopeeItem);
    setMappingExternalSku(shopeeItem.externalSku || shopeeItem.sellerSku || '');
    setSelectedInternalVariantId(shopeeItem.variantId || shopeeItem.internalVariant?.id || '');
    setMappingMultiplier(shopeeItem.multiplier || 1);

    const hasSellerSku = shopeeItem.sellerSku && !shopeeItem.sellerSku.startsWith('NAME::');
    const fallbackSku =
      shopeeItem.variationName && shopeeItem.productName
        ? `${shopeeItem.productName.slice(0, 8)}_${shopeeItem.variationName}`
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .toUpperCase()
        : (shopeeItem.externalSku || (shopeeItem.productName || 'SKU').slice(0, 10))
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .toUpperCase();

    setQuickCreateForm({
      name: shopeeItem.productName || shopeeItem.listingName || '',
      sku: hasSellerSku ? shopeeItem.sellerSku : fallbackSku,
      variantName: shopeeItem.variationName || 'Mặc định',
      costPrice: 0,
      sellPrice: 0,
    });
    setIsQuickCreateOpen(false);
    setIsMapModalOpen(true);
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMappingTarget?.shopId || !selectedInternalVariantId) {
      toast.warning('Vui lòng chọn biến thể SKU nội bộ');
      return;
    }
    try {
      await productsApi.createMapping({
        shopId: selectedMappingTarget.shopId,
        variantId: selectedInternalVariantId,
        sellerSku:
          mappingExternalSku ||
          selectedMappingTarget.sellerSku ||
          selectedMappingTarget.externalSku,
        productName: selectedMappingTarget.productName || selectedMappingTarget.listingName,
        variationName: selectedMappingTarget.variationName,
        multiplier: Math.max(1, parseInt(String(mappingMultiplier), 10) || 1),
      });
      setIsMapModalOpen(false);
      toast.success(
        'Liên kết SKU thành công!',
        'Đã gán SKU nội bộ và cập nhật các đơn hàng tồn đọng.'
      );
      loadMappings();
      loadAllVariants();
    } catch (err: any) {
      toast.error('Lỗi liên kết SKU', err.message);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy liên kết SKU này?')) return;
    try {
      await productsApi.deleteMapping(mappingId);
      toast.success('Đã hủy liên kết SKU');
      loadMappings();
      loadAllVariants();
    } catch (err: any) {
      toast.error('Lỗi hủy liên kết', err.message);
    }
  };

  const handleOpenBulkMapModal = () => {
    if (selectedListingIds.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 sản phẩm sàn để gom nhóm');
      return;
    }
    setBulkMapTargetVariantId('');
    const initMultipliers: Record<string, number> = {};
    selectedListingIds.forEach((id) => {
      const item = mappings.find((m) => m.id === id);
      if (item) {
        initMultipliers[id] = item.multiplier || 1;
      }
    });
    setBulkMultipliers(initMultipliers);
    setIsBulkMapModalOpen(true);
  };

  const handleSaveBulkMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkMapTargetVariantId) {
      toast.warning('Vui lòng chọn biến thể SKU nội bộ chung');
      return;
    }
    const selectedItems = mappings
      .filter((m) => selectedListingIds.includes(m.id))
      .map((m) => ({
        shopId: m.shopId,
        sellerSku: m.sellerSku || m.externalSku || '',
        productName: m.productName || m.listingName || '',
        variationName: m.variationName || '',
        multiplier: Math.max(
          1,
          parseInt(String(bulkMultipliers[m.id]), 10) || m.multiplier || 1
        ),
      }));

    if (selectedItems.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 sản phẩm sàn để gom nhóm');
      return;
    }

    try {
      await productsApi.bulkMapping({
        variantId: bulkMapTargetVariantId,
        items: selectedItems,
      });

      setIsBulkMapModalOpen(false);
      setSelectedListingIds([]);
      toast.success(
        'Gom SKU thành công!',
        `Đã gom ${selectedItems.length} sản phẩm sàn về 1 SKU kho và tự động đồng bộ đơn hàng.`
      );
      loadMappings();
      loadAllVariants();
    } catch (err: any) {
      toast.error('Lỗi gom nhóm SKU', err.message);
    }
  };

  const toggleSelectListing = (id: string) => {
    setSelectedListingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllListings = (displayed: any[]) => {
    if (selectedListingIds.length === displayed.length) {
      setSelectedListingIds([]);
    } else {
      setSelectedListingIds(displayed.map((m) => m.id));
    }
  };

  // Flatten all variants from full variant list or loaded products for the mapping selector
  const allInternalVariants =
    allInternalVariantsList.length > 0
      ? allInternalVariantsList
      : products.flatMap((p) =>
          (p.variants || []).map((v: any) => ({
            id: v.id,
            productName: p.name,
            variantName: v.name,
            sku: v.sku,
            barcode: v.barcode,
            unit: v.unit || 'cái',
          }))
        );

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#5865f2]/10 dark:bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2] shrink-0">
            <Package size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
              Sản phẩm & Mapping SKU
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Quản lý danh mục SKU nội bộ, giá vốn COGS và ánh xạ đơn hàng Shopee
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'PRODUCTS' && (
            <button
              onClick={handleOpenCreateProductModal}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={16} />
              Thêm sản phẩm
            </button>
          )}
          <button
            onClick={() => (activeTab === 'PRODUCTS' ? loadProducts() : loadMappings())}
            className="p-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#1c212d] rounded text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100/80 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded w-fit shrink-0">
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer border-0 ${
            activeTab === 'PRODUCTS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Boxes size={14} />
          <span>Sản phẩm & Biến thể nội bộ ({totalProducts})</span>
        </button>
        <button
          onClick={() => setActiveTab('MAPPINGS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer border-0 ${
            activeTab === 'MAPPINGS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <LinkIcon size={14} />
          <span>Liên kết SKU Shopee ({mappings.length})</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'PRODUCTS' ? (
          /* TAB 1: INTERNAL PRODUCTS */
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            {/* Search filter & Mapping status toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 p-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded">
              <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên SP, SKU kho, Barcode, SKU Shopee, phân loại..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-4 py-1.5 h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleToggleExpandAllShopee}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                    isAllShopeeVariantsExpanded
                      ? 'bg-[#5865f2] text-white border-[#5865f2] shadow-xs'
                      : 'bg-gray-50 dark:bg-[#1a1b23] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#5865f2]/40'
                  }`}
                  title="Mở rộng hoặc thu gọn để xem tất cả biến thể Shopee trực tiếp trên bảng"
                >
                  <Store size={13} />
                  <span>{isAllShopeeVariantsExpanded ? 'Thu gọn SKU Shopee' : 'Xem đầy đủ SKU Shopee'}</span>
                </button>

                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0 ml-1">
                  Liên kết Shopee:
                </span>
                <Select
                  value={mappingStatusFilter}
                  onChange={(val: any) => setMappingStatusFilter(val)}
                  options={[
                    { value: 'ALL', label: 'Tất cả trạng thái' },
                    { value: 'MAPPED', label: 'Đã liên kết SKU Shopee' },
                    { value: 'UNMAPPED', label: 'Chưa liên kết SKU Shopee' },
                  ]}
                  size="sm"
                  className="w-52"
                  menuWidth="w-56"
                />
              </div>
            </div>

            {/* Products Table with Bottom-Pinned SystemPagination */}
            <div className="flex-1 flex flex-col min-h-0">
              {(() => {
                const displayedProducts = products.filter((product) => {
                  if (mappingStatusFilter === 'ALL') return true;
                  const variants = product.variants || [];
                  const hasAnyMapping = variants.some(
                    (v: any) => v.listingMappings && v.listingMappings.length > 0
                  );
                  if (mappingStatusFilter === 'MAPPED') return hasAnyMapping;
                  if (mappingStatusFilter === 'UNMAPPED') return !hasAnyMapping;
                  return true;
                });

                return (
                  <SystemTableWrapper
                    tableClassName="min-w-[1200px]"
                    pagination={
                      <SystemPagination
                        currentPage={page}
                        itemsPerPage={limit}
                        totalItems={totalProducts}
                        onPageChange={setPage}
                        onLimitChange={(l) => {
                          setLimit(l);
                          setPage(1);
                        }}
                      />
                    }
                  >
                    <SystemThead>
                      <SystemTh className="w-[260px] min-w-[240px]" align="left">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Package size={13} className="text-[#5865f2]" />
                          <span>Sản phẩm / SKU cha</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[200px] min-w-[180px]" align="left">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Layers size={13} className="text-[#5865f2]" />
                          <span>Biến thể & Mã SKU</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[140px] min-w-[130px]" align="left">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Barcode size={13} className="text-gray-400" />
                          <span>Barcode</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[170px] min-w-[160px]" align="left">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Store size={13} className="text-orange-500" />
                          <span>Biến thể Shopee liên kết</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[130px] min-w-[120px]" align="right">
                        <div className="flex items-center justify-end gap-1.5 font-semibold">
                          <DollarSign size={13} className="text-amber-500" />
                          <span>Giá vốn (COGS)</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[130px] min-w-[120px]" align="right">
                        <div className="flex items-center justify-end gap-1.5 font-semibold">
                          <TrendingUp size={13} className="text-emerald-500" />
                          <span>Giá bán</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[110px] min-w-[100px]" align="center">
                        <div className="flex items-center justify-center gap-1.5 font-semibold">
                          <AlertCircle size={13} className="text-blue-500" />
                          <span>Cảnh báo tồn</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[60px] min-w-[60px]" align="center">
                        <div className="flex items-center justify-center" title="Thao tác">
                          <SlidersHorizontal size={13} className="text-gray-400" />
                        </div>
                      </SystemTh>
                    </SystemThead>
                    <SystemTbody>
                      {isLoadingProducts ? (
                        <SystemTableSkeleton cols={8} rows={7} />
                      ) : displayedProducts.length === 0 ? (
                        <SystemTableEmpty
                          colSpan={8}
                          title="Không tìm thấy sản phẩm nào"
                          description={
                            searchTerm || mappingStatusFilter !== 'ALL'
                              ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái.'
                              : 'Chưa có sản phẩm nào. Nhấn "Thêm sản phẩm" để khởi tạo SKU nội bộ.'
                          }
                        />
                      ) : (
                        displayedProducts.map((product) => {
                          const variants =
                            product.variants && product.variants.length > 0
                              ? product.variants
                              : [
                                  {
                                    id: product.id + '_def',
                                    name: product.name,
                                    sku: product.code || product.sku || 'N/A',
                                    barcode: null,
                                    costPrice: 0,
                                    sellingPrice: 0,
                                    lowStockThreshold: 5,
                                    isSynthetic: true,
                                    listingMappings: [],
                                  },
                                ];

                          return variants.map((variant: any, vIdx: number) => {
                            const hasMappings =
                              Array.isArray(variant.listingMappings) &&
                              variant.listingMappings.length > 0;

                            return (
                              <SystemTr key={variant.id}>
                                {/* Product Parent Info (RowSpan for first variant) */}
                                {vIdx === 0 ? (
                                  <td
                                    rowSpan={variants.length}
                                    className="py-3.5 px-4 font-medium text-gray-900 dark:text-white align-top border-r border-gray-100 dark:border-gray-800/60"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div
                                          onClick={() => handleOpenProductDetail(product)}
                                          className="font-bold text-gray-900 dark:text-gray-100 hover:text-[#5865f2] dark:hover:text-[#5865f2] hover:underline cursor-pointer flex items-center gap-1.5 group"
                                          title="Nhấn để xem chi tiết sản phẩm và các biến thể Shopee liên kết"
                                        >
                                          <span className="truncate">{product.name}</span>
                                          <Eye size={12} className="shrink-0 text-gray-400 group-hover:text-[#5865f2] transition-colors" />
                                        </div>
                                        <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                                          Mã: {product.code || product.sku}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">
                                            {variants.length} biến thể
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenProductDetail(product)}
                                            className="text-[10px] text-[#5865f2] hover:underline cursor-pointer font-medium"
                                          >
                                            Chi tiết &rarr;
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                ) : null}

                                {/* Variant Info */}
                                <SystemTd>
                                  <span className="font-medium text-gray-900 dark:text-gray-200">
                                    {variant.name}
                                  </span>
                                  <div
                                    onClick={() => {
                                      if (!variant.isSynthetic) {
                                        setSelectedVariantForHistory({
                                          id: variant.id,
                                          sku: variant.sku,
                                          productName: product.name,
                                        });
                                        setIsHistoryModalOpen(true);
                                      }
                                    }}
                                    className="text-[11px] font-mono text-[#5865f2] font-semibold mt-0.5 hover:underline cursor-pointer"
                                    title="Nhấn để xem sổ cái & lịch sử kho của SKU này"
                                  >
                                    {variant.sku}
                                  </div>
                                </SystemTd>

                                {/* Barcode */}
                                <SystemTd className="font-mono text-gray-600 dark:text-gray-400">
                                  {variant.barcode || (
                                    <span className="text-gray-300 dark:text-gray-600">--</span>
                                  )}
                                </SystemTd>

                                {/* Biến thể Shopee liên kết: Chỉ hiển thị số lượng badge gọn gàng, nhấn vào để mở Modal */}
                                <SystemTd>
                                  {hasMappings ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenShopeeVariantsModal(product, variant)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-indigo-50/90 dark:bg-indigo-950/50 text-[#5865f2] dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:border-[#5865f2]/60 hover:shadow-xs transition-all cursor-pointer group"
                                      title="Nhấn để xem chi tiết và quản lý các SKU Shopee đã liên kết"
                                    >
                                      <Store size={12} className="text-[#5865f2] dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                                      <span>{variant.listingMappings.length} SKU Shopee</span>
                                      <ExternalLink size={10} className="text-indigo-400 group-hover:text-[#5865f2] opacity-70 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => !variant.isSynthetic && handleOpenShopeeVariantsModal(product, variant)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/70 hover:bg-amber-100/90 dark:hover:bg-amber-900/40 transition-all cursor-pointer"
                                      title="Chưa liên kết phân loại Shopee nào. Nhấn để gán SKU"
                                    >
                                      <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                                      <span>Chưa liên kết</span>
                                      {!variant.isSynthetic && (
                                        <span className="text-[#5865f2] dark:text-indigo-400 font-semibold ml-0.5 hover:underline">
                                          + Gán
                                        </span>
                                      )}
                                    </button>
                                  )}
                                </SystemTd>

                                {/* COGS */}
                                <SystemTd align="right" className="font-medium text-amber-600 dark:text-amber-400">
                                  {formatCurrency(variant.costPrice || 0)}
                                </SystemTd>

                                {/* Sell Price */}
                                <SystemTd align="right" className="font-medium text-gray-900 dark:text-white">
                                  {formatCurrency(variant.sellingPrice ?? variant.sellPrice ?? 0)}
                                </SystemTd>

                                {/* Min Stock Alert */}
                                <SystemTd align="center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                    &le; {variant.lowStockThreshold ?? variant.minStockAlert ?? 5} cái
                                  </span>
                                </SystemTd>

                                {/* Action */}
                                <SystemTd align="center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                          title="Thao tác"
                                        >
                                          <MoreHorizontal size={14} />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() => handleOpenProductDetail(product)}
                                        >
                                          <Eye size={13} className="text-gray-400" />
                                          <span>Xem chi tiết sản phẩm</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleOpenShopeeVariantsModal(product, variant)}
                                        >
                                          <Store size={13} className="text-[#5865f2]" />
                                          <span>Biến thể Shopee ({variant.listingMappings?.length || 0})</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleOpenEditProduct(product)}
                                        >
                                          <Edit2 size={13} className="text-blue-500" />
                                          <span>Sửa thông tin SP cha</span>
                                        </DropdownMenuItem>
                                        {!variant.isSynthetic && (
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setSelectedVariantForHistory({
                                                id: variant.id,
                                                sku: variant.sku,
                                                productName: product.name,
                                              });
                                              setIsHistoryModalOpen(true);
                                            }}
                                          >
                                            <History size={13} className="text-indigo-500" />
                                            <span>Sổ cái & Lịch sử kho</span>
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          onClick={() => handleOpenEditVariant(variant)}
                                        >
                                          <Edit2 size={13} className="text-gray-400" />
                                          <span>Sửa biến thể này</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {!variant.isSynthetic && (
                                          <DropdownMenuItem
                                            variant="destructive"
                                            onClick={() => handleOpenDeleteVariant(variant)}
                                          >
                                            <Trash2 size={13} />
                                            <span>Xóa biến thể này</span>
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          variant="destructive"
                                          onClick={() => handleOpenDeleteProduct(product)}
                                        >
                                          <Trash2 size={13} />
                                          <span>Xóa sản phẩm cha</span>
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </SystemTd>
                              </SystemTr>
                            );
                          });
                        })
                      )}
                    </SystemTbody>
                  </SystemTableWrapper>
                );
              })()}
            </div>
          </div>
        ) : (
          /* TAB 2: SHOPEE LISTING MAPPINGS & GROUPING */
          <div className="flex flex-col gap-4">
            {/* Banner Guide & Invariant */}
            <div className="bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/50 p-4 rounded flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <span className="font-bold">
                  Gom nhóm nhiều sản phẩm sàn về 1 SKU kho & Tự động nhân hệ số:
                </span>{' '}
                Bạn có thể gán nhiều sản phẩm Shopee có tên khác nhau (hoặc không có SKU) về cùng 1 biến thể SKU kho nội bộ để quản lý tồn kho tập trung. Hệ số quy đổi (ví dụ:{' '}
                <span className="font-semibold underline">Combo 2 thùng</span> → nhân 2;{' '}
                <span className="font-semibold underline">3 thùng</span> → nhân 3) sẽ tự động nhân với số lượng đặt để trừ kho chính xác (ví dụ: đặt 2 đơn x hệ số 3 = trừ 6 sản phẩm kho).
              </div>
            </div>

            {/* Filter and View Mode Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#161b26] p-3 rounded border border-gray-200 dark:border-gray-800">
              <div className="flex flex-wrap items-center gap-3">
                {/* Shop filter */}
                <div className="flex items-center gap-2">
                  <Store size={15} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 shrink-0">
                    Lọc Shop:
                  </span>
                  <Select
                    value={mappingShopFilter}
                    onChange={(val: any) => setMappingShopFilter(val)}
                    options={[
                      { value: '', label: 'Tất cả shop' },
                      ...shops.map((s) => ({
                        value: s.id,
                        label: `${s.name} (${s.code})`,
                      })),
                    ]}
                    size="sm"
                    className="w-44"
                    menuWidth="w-52"
                  />
                </div>

                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm tên sản phẩm sàn, phân loại, SKU..."
                    value={mappingSearchTerm}
                    onChange={(e) => setMappingSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#5865f2] w-64"
                  />
                  {mappingSearchTerm && (
                    <button
                      onClick={() => setMappingSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* View Mode Toggle & Bulk Action */}
              <div className="flex items-center gap-2">
                {selectedListingIds.length > 0 && (
                  <button
                    onClick={handleOpenBulkMapModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold rounded shadow-xs transition-colors cursor-pointer"
                  >
                    <Layers size={14} />
                    Gom {selectedListingIds.length} sản phẩm đã chọn về 1 SKU kho
                  </button>
                )}

                <div className="flex items-center p-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs font-semibold">
                  <button
                    onClick={() => setMappingViewMode('LIST')}
                    className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                      mappingViewMode === 'LIST'
                        ? 'bg-white dark:bg-[#131720] text-[#5865f2] dark:text-indigo-400 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    <ListFilter size={13} />
                    Tất cả listing ({mappings.length})
                  </button>
                  <button
                    onClick={() => setMappingViewMode('GROUPED')}
                    className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                      mappingViewMode === 'GROUPED'
                        ? 'bg-white dark:bg-[#131720] text-[#5865f2] dark:text-indigo-400 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    <Layers size={13} />
                    Gom nhóm theo SKU kho
                  </button>
                </div>
              </div>
            </div>

            {/* Content for View Mode: LIST */}
            {mappingViewMode === 'LIST' ? (
              (() => {
                const filteredMappings = mappings.filter((m) => {
                  if (!mappingSearchTerm) return true;
                  const t = mappingSearchTerm.toLowerCase();
                  return (
                    (m.productName || m.listingName || '').toLowerCase().includes(t) ||
                    (m.variationName || '').toLowerCase().includes(t) ||
                    (m.sellerSku || m.externalSku || '').toLowerCase().includes(t) ||
                    (m.variant?.name || '').toLowerCase().includes(t) ||
                    (m.variant?.sku || '').toLowerCase().includes(t)
                  );
                });
                const paginatedMappings = filteredMappings.slice(
                  (mappingPage - 1) * mappingLimit,
                  mappingPage * mappingLimit
                );

                return (
                  <SystemTableWrapper
                    tableClassName="min-w-[1100px]"
                    pagination={
                      <SystemPagination
                        currentPage={mappingPage}
                        itemsPerPage={mappingLimit}
                        totalItems={filteredMappings.length}
                        onPageChange={setMappingPage}
                        onLimitChange={(l) => {
                          setMappingLimit(l);
                          setMappingPage(1);
                        }}
                      />
                    }
                  >
                    <SystemThead>
                      <SystemTh className="w-[44px] text-center" align="center">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={
                              filteredMappings.length > 0 &&
                              selectedListingIds.length === filteredMappings.length
                            }
                            indeterminate={
                              selectedListingIds.length > 0 &&
                              selectedListingIds.length < filteredMappings.length
                            }
                            onChange={() => toggleSelectAllListings(filteredMappings)}
                          />
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[140px]" align="left">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Store size={13} className="text-orange-500" />
                          <span>Shop</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[360px]" align="left">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Package size={13} className="text-[#5865f2]" />
                          <span>Tên Sản Phẩm & Phân Loại trên Sàn</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[130px]" align="center">
                        <div className="flex items-center justify-center gap-1.5 font-semibold">
                          <Layers size={13} className="text-amber-500" />
                          <span>Hệ số quy đổi</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[240px]" align="left">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <LinkIcon size={13} className="text-emerald-500" />
                          <span>SKU Biến thể kho đã liên kết</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[130px]" align="center">
                        <div className="flex items-center justify-center gap-1.5 font-semibold">
                          <CheckCircle size={13} className="text-blue-500" />
                          <span>Trạng thái</span>
                        </div>
                      </SystemTh>
                      <SystemTh className="w-[64px]" align="center">
                        <div className="flex items-center justify-center" title="Thao tác">
                          <SlidersHorizontal size={13} className="text-gray-400" />
                        </div>
                      </SystemTh>
                    </SystemThead>
                    <SystemTbody>
                      {isLoadingMappings ? (
                        <SystemTableSkeleton cols={7} rows={7} />
                      ) : filteredMappings.length === 0 ? (
                        <SystemTableEmpty
                          colSpan={7}
                          title="Không có sản phẩm sàn nào"
                          description="Sau khi tải lên file Excel Shopee hoặc phát sinh đơn hàng, các sản phẩm sàn sẽ hiển thị ở đây để gán vào SKU kho."
                        />
                      ) : (
                        paginatedMappings.map((m) => {
                          const isSelected = selectedListingIds.includes(m.id);
                          const internalVariant = m.variant || m.internalVariant;
                          const isMapped = m.isMapped !== false && Boolean(internalVariant);

                          return (
                            <SystemTr
                              key={m.id}
                              className={isSelected ? 'bg-[#5865f2]/5 dark:bg-[#5865f2]/10' : undefined}
                            >
                              <SystemTd align="center">
                                <div className="flex items-center justify-center">
                                  <Checkbox
                                    checked={isSelected}
                                    onChange={() => toggleSelectListing(m.id)}
                                  />
                                </div>
                              </SystemTd>
                              <SystemTd className="shrink-0">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                  {m.shop?.code || m.shop?.name || m.shopId}
                                </span>
                              </SystemTd>
                              <SystemTd className="max-w-sm">
                                <div className="font-semibold text-gray-900 dark:text-white leading-snug">
                                  {m.productName || m.listingName || '--'}
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {m.variationName ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-[#5865f2] border border-indigo-200/50 dark:border-indigo-800/40">
                                      Phân loại: {m.variationName}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">Không có phân loại</span>
                                  )}
                                  {m.sellerSku && !m.sellerSku.startsWith('NAME::') && (
                                    <span className="text-xs font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                      SKU sàn: {m.sellerSku}
                                    </span>
                                  )}
                                </div>
                              </SystemTd>
                              <SystemTd align="center">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                                    (m.multiplier || 1) > 1
                                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-mono'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono'
                                  }`}
                                >
                                  x{m.multiplier || 1}
                                </span>
                              </SystemTd>
                              <SystemTd>
                                {internalVariant ? (
                                  <div>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      {internalVariant.name}
                                    </span>
                                    <div className="text-xs font-mono text-[#5865f2]">
                                      Mã SKU: {internalVariant.sku}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-rose-500 font-medium inline-flex items-center gap-1">
                                    <AlertTriangle size={13} /> Chưa gán vào kho
                                  </span>
                                )}
                              </SystemTd>
                              <SystemTd align="center">
                                {isMapped ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle size={12} /> Đã liên kết
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                    <AlertTriangle size={12} /> Chờ gán
                                  </span>
                                )}
                              </SystemTd>
                              <SystemTd align="center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                        title="Thao tác"
                                      >
                                        <MoreHorizontal size={15} />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => handleOpenMapModal(m)}
                                      >
                                        <LinkIcon size={14} className="text-[#5865f2]" />
                                        <span>{isMapped ? 'Đổi mapping SKU' : 'Gán vào SKU kho'}</span>
                                      </DropdownMenuItem>
                                      {isMapped && m.id && !m.id.startsWith('unmapped-') && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            variant="destructive"
                                            onClick={() => handleDeleteMapping(m.id)}
                                          >
                                            <Trash2 size={14} />
                                            <span>Hủy liên kết mapping</span>
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </SystemTd>
                            </SystemTr>
                          );
                        })
                      )}
                    </SystemTbody>
                  </SystemTableWrapper>
                );
              })()
            ) : (
              /* Content for View Mode: GROUPED BY WAREHOUSE SKU */
              <div className="space-y-4">
                {(() => {
                  const groups = new Map<string, { variant: any; items: any[] }>();
                  const unmappedItems: any[] = [];

                  mappings
                    .filter((m) => {
                      if (!mappingSearchTerm) return true;
                      const t = mappingSearchTerm.toLowerCase();
                      return (
                        (m.productName || m.listingName || '').toLowerCase().includes(t) ||
                        (m.variationName || '').toLowerCase().includes(t) ||
                        (m.sellerSku || m.externalSku || '').toLowerCase().includes(t) ||
                        (m.variant?.name || '').toLowerCase().includes(t) ||
                        (m.variant?.sku || '').toLowerCase().includes(t)
                      );
                    })
                    .forEach((m) => {
                      const v = m.variant || m.internalVariant;
                      if (v && v.id) {
                        if (!groups.has(v.id)) {
                          groups.set(v.id, { variant: v, items: [] });
                        }
                        groups.get(v.id)!.items.push(m);
                      } else {
                        unmappedItems.push(m);
                      }
                    });

                  const groupList = Array.from(groups.values());

                  return (
                    <div className="space-y-4">
                      {groupList.length === 0 && unmappedItems.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 bg-white dark:bg-[#1a1b23] rounded border border-gray-200 dark:border-gray-800">
                          Chưa có sản phẩm nào được gom nhóm.
                        </div>
                      ) : (
                        groupList.map(({ variant, items }) => (
                          <div
                            key={variant.id}
                            className="bg-white dark:bg-[#1a1b23] rounded border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden"
                          >
                            {/* Group Header */}
                            <div className="p-3.5 bg-gray-50/80 dark:bg-[#131720] border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center font-bold">
                                  <Boxes size={18} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 dark:text-white text-xs">
                                      {variant.product?.name ? `${variant.product.name} - ` : ''}
                                      {variant.name}
                                    </span>
                                    <span className="font-mono text-[11px] font-bold text-[#5865f2] bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200/50">
                                      SKU: {variant.sku}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-500 mt-0.5">
                                    Đơn vị tính: {variant.unit || 'cái'} | Giá vốn:{' '}
                                    {formatCurrency(variant.costPrice || 0)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle size={12} />
                                  Đang gom {items.length} tên sản phẩm sàn
                                </span>
                              </div>
                            </div>

                            {/* Group Table: Listings belonging to this SKU */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-gray-50/40 dark:bg-gray-800/20 text-gray-400 border-b border-gray-100 dark:border-gray-800 text-[11px]">
                                    <th className="py-2.5 px-4">Shop</th>
                                    <th className="py-2.5 px-4">Tên Sản Phẩm trên Shopee</th>
                                    <th className="py-2.5 px-4">Phân Loại Hàng</th>
                                    <th className="py-2.5 px-3 text-center">Hệ số quy đổi</th>
                                    <th className="py-2.5 px-4 text-center">Thao tác</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                                  {items.map((it) => (
                                    <tr key={it.id} className="hover:bg-gray-50/50 dark:hover:bg-[#202533]">
                                      <td className="py-2.5 px-4 font-medium text-gray-700 dark:text-gray-300">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800">
                                          {it.shop?.code || it.shop?.name || it.shopId}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-4 font-semibold text-gray-900 dark:text-white">
                                        {it.productName || it.listingName || '--'}
                                      </td>
                                      <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">
                                        {it.variationName ? (
                                          <span className="px-2 py-0.5 rounded bg-indigo-50/60 dark:bg-indigo-950/30 text-[#5865f2] font-semibold text-[11px]">
                                            {it.variationName}
                                          </span>
                                        ) : (
                                          '--'
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600">
                                        x{it.multiplier || 1}
                                      </td>
                                      <td className="py-2.5 px-4 text-center">
                                        <div className="inline-flex items-center gap-1.5">
                                          <button
                                            onClick={() => handleOpenMapModal(it)}
                                            className="px-2 py-0.5 text-[11px] text-[#5865f2] hover:bg-[#5865f2]/10 rounded border border-[#5865f2]/30"
                                          >
                                            Sửa hệ số / SKU
                                          </button>
                                          {it.id && !it.id.startsWith('unmapped-') && (
                                            <button
                                              onClick={() => handleDeleteMapping(it.id)}
                                              className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                                              title="Gỡ khỏi nhóm"
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))
                      )}

                      {/* Unmapped section in Grouped View */}
                      {unmappedItems.length > 0 && (
                        <div className="bg-rose-50/40 dark:bg-rose-950/10 rounded border border-rose-200 dark:border-rose-900/50 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
                              <AlertTriangle size={15} />
                              Có {unmappedItems.length} sản phẩm sàn chưa được gán vào bất kỳ SKU kho nào
                            </div>
                          </div>

                          <div className="bg-white dark:bg-[#161b26] rounded border border-rose-200 dark:border-rose-900/40 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 border-b border-rose-100 text-[11px] font-semibold">
                                  <th className="py-2.5 px-4">Shop</th>
                                  <th className="py-2.5 px-4">Tên Sản Phẩm trên Shopee</th>
                                  <th className="py-2.5 px-4">Phân Loại Hàng</th>
                                  <th className="py-2.5 px-3 text-center">Hệ số tự nhận</th>
                                  <th className="py-2.5 px-4 text-center">Thao tác</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {unmappedItems.map((it) => (
                                  <tr key={it.id} className="hover:bg-gray-50/50 dark:hover:bg-[#202533]">
                                    <td className="py-2.5 px-4 font-medium text-gray-700 dark:text-gray-300">
                                      {it.shop?.code || it.shopId}
                                    </td>
                                    <td className="py-2.5 px-4 font-semibold text-gray-900 dark:text-white">
                                      {it.productName || it.listingName || '--'}
                                    </td>
                                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">
                                      {it.variationName || '--'}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600">
                                      x{it.multiplier || 1}
                                    </td>
                                    <td className="py-2.5 px-4 text-center">
                                      <button
                                        onClick={() => handleOpenMapModal(it)}
                                        className="px-3 py-1 bg-[#5865f2] hover:bg-[#4752c4] text-white text-[11px] font-bold rounded shadow-2xs"
                                      >
                                        Gán vào SKU kho
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: CREATE PRODUCT */}
      {isCreateProductModalOpen && (
        <Modal
          isOpen={isCreateProductModalOpen}
          onClose={() => setIsCreateProductModalOpen(false)}
          title="Thêm sản phẩm nội bộ mới"
          subtitle="Tạo sản phẩm và các biến thể SKU để theo dõi tồn kho và liên kết với sàn"
          icon={Package}
          maxWidth="w-[92vw] max-w-4xl"
        >
          <form onSubmit={handleCreateProductSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tên sản phẩm *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Áo Thun Nam Cotton 100%"
                    value={createProductForm.name}
                    onChange={(e) => handleProductNameChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Mã sản phẩm / SKU cha *
                      </label>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium">
                        Tự sinh
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRegenerateSku}
                      className="inline-flex items-center gap-1 text-[11px] text-[#5865f2] hover:text-[#4752c4] font-medium transition-colors cursor-pointer"
                      title="Tự động sinh lại mã SKU mới"
                    >
                      <Sparkles size={11} />
                      Đổi mã mới
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="VD: ATN-01"
                    value={createProductForm.sku}
                    onChange={(e) =>
                      setCreateProductForm({
                        ...createProductForm,
                        sku: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono uppercase bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Mô tả sản phẩm
                </label>
                <textarea
                  rows={2}
                  placeholder="Mô tả tóm tắt..."
                  value={createProductForm.description}
                  onChange={(e) =>
                    setCreateProductForm({ ...createProductForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              {/* Variants Section */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      Các biến thể SKU nội bộ ({createProductForm.variants.length})
                    </span>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Có thể tạo ngay hoặc để trống để tự động đồng bộ sau theo file Excel sàn Shopee
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={variantFileInputRef}
                      onChange={handleImportVariantsFromExcel}
                      accept=".xlsx, .xls, .csv"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => variantFileInputRef.current?.click()}
                      className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 transition-colors"
                      title="Tải lên file Excel Shopee hoặc bảng kê để tự động nạp danh sách biến thể"
                    >
                      <FileSpreadsheet size={13} /> Nhập từ Excel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddVariantField}
                      className="text-xs text-[#5865f2] font-semibold flex items-center gap-1 hover:underline cursor-pointer px-2.5 py-1 rounded bg-[#5865f2]/10 border border-[#5865f2]/20 transition-colors"
                    >
                      <Plus size={13} /> Thêm biến thể
                    </button>
                  </div>
                </div>

                {createProductForm.variants.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-400 space-y-1">
                    <p className="font-medium text-gray-600 dark:text-gray-300">
                      Chưa có biến thể nào được tạo thủ công.
                    </p>
                    <p className="text-[11px]">
                      Sản phẩm sẽ tự động tạo 1 biến thể SKU mặc định, và các phân loại chi tiết có thể nạp từ file Excel hoặc tự động gợi ý khi tải lên đơn hàng Shopee.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                    {createProductForm.variants.map((v, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-gray-50/80 dark:bg-[#131720]/80 rounded-lg border border-gray-200/70 dark:border-gray-800 space-y-2.5"
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-gray-200/50 dark:border-gray-800">
                          <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                            <Boxes size={12} className="text-[#5865f2]" />
                            Biến thể #{idx + 1} {v.name ? `(${v.name})` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveVariantField(idx)}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                            title="Xóa biến thể này"
                          >
                            <Trash2 size={13} />
                            <span className="hidden sm:inline">Xóa</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-[11px] font-medium text-gray-500">
                              Tên biến thể
                            </label>
                            <input
                              type="text"
                              required
                              value={v.name}
                              onChange={(e) => {
                                const next = [...createProductForm.variants];
                                next[idx].name = e.target.value;
                                setCreateProductForm({ ...createProductForm, variants: next });
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-gray-500">
                              Mã SKU biến thể *
                            </label>
                            <input
                              type="text"
                              required
                              value={v.sku}
                              onChange={(e) => {
                                const next = [...createProductForm.variants];
                                next[idx].sku = e.target.value;
                                setCreateProductForm({ ...createProductForm, variants: next });
                              }}
                              className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-gray-500">
                              Barcode quét
                            </label>
                            <input
                              type="text"
                              value={v.barcode}
                              onChange={(e) => {
                                const next = [...createProductForm.variants];
                                next[idx].barcode = e.target.value;
                                setCreateProductForm({ ...createProductForm, variants: next });
                              }}
                              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-[11px] font-medium text-gray-500">
                              Giá vốn (VND)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={v.costPrice}
                              onChange={(e) => {
                                const next = [...createProductForm.variants];
                                next[idx].costPrice = parseFloat(e.target.value) || 0;
                                setCreateProductForm({ ...createProductForm, variants: next });
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-gray-500">
                              Giá bán (VND)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={v.sellPrice}
                              onChange={(e) => {
                                const next = [...createProductForm.variants];
                                next[idx].sellPrice = parseFloat(e.target.value) || 0;
                                setCreateProductForm({ ...createProductForm, variants: next });
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-gray-500">
                              Cảnh báo tồn tối thiểu
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={v.minStockAlert}
                              onChange={(e) => {
                                const next = [...createProductForm.variants];
                                next[idx].minStockAlert = parseInt(e.target.value, 10) || 5;
                                setCreateProductForm({ ...createProductForm, variants: next });
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                variant="secondary"
                onClick={() => setIsCreateProductModalOpen(false)}
              >
                Hủy
              </ModalButton>
              <ModalButton variant="primary" type="submit">
                Lưu sản phẩm
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 2: EDIT VARIANT */}
      {isEditVariantModalOpen && selectedVariantForEdit && (
        <Modal
          isOpen={isEditVariantModalOpen && Boolean(selectedVariantForEdit)}
          onClose={() => setIsEditVariantModalOpen(false)}
          title="Cập nhật biến thể SKU"
          subtitle={`Mã SKU nội bộ: ${selectedVariantForEdit.sku}`}
          icon={Edit2}
          maxWidth="w-[92vw] max-w-xl"
        >
          <form onSubmit={handleUpdateVariantSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tên biến thể *
                </label>
                <input
                  type="text"
                  required
                  value={editVariantForm.name}
                  onChange={(e) =>
                    setEditVariantForm({ ...editVariantForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Barcode quét xuất kho
                </label>
                <input
                  type="text"
                  placeholder="Barcode quét (EAN/UPC/Custom)"
                  value={editVariantForm.barcode}
                  onChange={(e) =>
                    setEditVariantForm({ ...editVariantForm, barcode: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Giá vốn COGS (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editVariantForm.costPrice}
                    onChange={(e) =>
                      setEditVariantForm({
                        ...editVariantForm,
                        costPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Giá bán (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editVariantForm.sellPrice}
                    onChange={(e) =>
                      setEditVariantForm({
                        ...editVariantForm,
                        sellPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ngưỡng cảnh báo tồn kho tối thiểu
                </label>
                <input
                  type="number"
                  min="0"
                  value={editVariantForm.minStockAlert}
                  onChange={(e) =>
                    setEditVariantForm({
                      ...editVariantForm,
                      minStockAlert: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                variant="secondary"
                onClick={() => setIsEditVariantModalOpen(false)}
              >
                Hủy
              </ModalButton>
              <ModalButton variant="primary" type="submit">
                Lưu thay đổi
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 2B: EDIT PRODUCT (PARENT) */}
      {isEditProductModalOpen && selectedProductForEdit && (
        <Modal
          isOpen={isEditProductModalOpen}
          onClose={() => setIsEditProductModalOpen(false)}
          title="Chỉnh sửa sản phẩm cha"
          subtitle={`Cập nhật thông tin chung cho sản phẩm [${selectedProductForEdit.code || selectedProductForEdit.sku}]`}
          icon={Package}
          maxWidth="w-[92vw] max-w-2xl"
        >
          <form onSubmit={handleUpdateProductSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tên sản phẩm *
                </label>
                <input
                  type="text"
                  required
                  value={editProductForm.name}
                  onChange={(e) =>
                    setEditProductForm({ ...editProductForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Mô tả sản phẩm
                </label>
                <textarea
                  rows={3}
                  value={editProductForm.description}
                  onChange={(e) =>
                    setEditProductForm({ ...editProductForm, description: e.target.value })
                  }
                  placeholder="Mô tả tóm tắt sản phẩm..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                variant="secondary"
                onClick={() => setIsEditProductModalOpen(false)}
              >
                Hủy
              </ModalButton>
              <ModalButton variant="primary" type="submit">
                Lưu thay đổi
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 2C: DELETE PRODUCT (PARENT) */}
      {isDeleteProductModalOpen && selectedProductForDelete && (
        <Modal
          isOpen={isDeleteProductModalOpen}
          onClose={() => setIsDeleteProductModalOpen(false)}
          title="Xác nhận xóa sản phẩm"
          subtitle={`Bạn có chắc muốn xóa "${selectedProductForDelete.name}" (${selectedProductForDelete.code || selectedProductForDelete.sku})?`}
          icon={Trash2}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3">
              <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold">Bảo toàn sổ cái và đơn hàng:</p>
                  <p className="mt-0.5 text-amber-700 dark:text-amber-400/90 leading-relaxed">
                    Nếu sản phẩm hoặc các biến thể đã từng phát sinh đơn hàng hoặc tồn kho trong sổ cái, hệ thống sẽ lưu trữ sản phẩm (chuyển sang trạng thái Lưu trữ/Ngừng kinh doanh) thay vì xóa vật lý nhằm bảo vệ toàn vẹn lịch sử đối soát và kế toán.
                  </p>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <ModalButton
                variant="secondary"
                onClick={() => setIsDeleteProductModalOpen(false)}
                disabled={isDeletingProduct}
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleDeleteProductSubmit}
                disabled={isDeletingProduct}
              >
                {isDeletingProduct ? 'Đang xóa...' : 'Xác nhận xóa'}
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}

      {/* MODAL 2D: DELETE VARIANT */}
      {isDeleteVariantModalOpen && selectedVariantForDelete && (
        <Modal
          isOpen={isDeleteVariantModalOpen}
          onClose={() => setIsDeleteVariantModalOpen(false)}
          title="Xác nhận xóa biến thể SKU"
          subtitle={`Bạn có chắc muốn xóa biến thể "${selectedVariantForDelete.name}" (SKU: ${selectedVariantForDelete.sku})?`}
          icon={Trash2}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3">
              <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold">Kiểm tra ràng buộc:</p>
                  <p className="mt-0.5 text-amber-700 dark:text-amber-400/90 leading-relaxed">
                    Nếu biến thể đã được gắn với đơn hàng hoặc còn tồn kho trong sổ cái, hệ thống sẽ tự động lưu trữ biến thể nhằm bảo toàn tính bất biến của sổ cái kế toán.
                  </p>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <ModalButton
                variant="secondary"
                onClick={() => setIsDeleteVariantModalOpen(false)}
                disabled={isDeletingVariant}
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleDeleteVariantSubmit}
                disabled={isDeletingVariant}
              >
                {isDeletingVariant ? 'Đang xóa...' : 'Xác nhận xóa'}
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}


      {/* MODAL 3: MAP SHOPEE SKU */}
      {isMapModalOpen && selectedMappingTarget && (
        <Modal
          isOpen={isMapModalOpen && Boolean(selectedMappingTarget)}
          onClose={() => setIsMapModalOpen(false)}
          title="Gán sản phẩm sàn vào SKU kho nội bộ"
          subtitle="Liên kết phân loại hàng Shopee với SKU kho để tự động đồng bộ tồn kho và giá vốn COGS"
          icon={Boxes}
          maxWidth="w-[92vw] max-w-2xl"
        >
          <form onSubmit={handleSaveMapping} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-4">
              {/* Product Info Summary Box */}
              <div className="p-3.5 bg-gray-50/80 dark:bg-[#131720]/80 rounded-lg border border-gray-200/70 dark:border-gray-800 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Shop:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {selectedMappingTarget.shop?.name || selectedMappingTarget.shopId}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Tên sản phẩm Shopee:</span>
                  <p className="font-semibold text-gray-900 dark:text-white mt-0.5 leading-snug">
                    {selectedMappingTarget.productName || selectedMappingTarget.listingName || '--'}
                  </p>
                </div>
                {selectedMappingTarget.variationName && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200/50 dark:border-gray-800/60">
                    <span className="text-gray-500 font-medium">Phân loại hàng:</span>
                    <span className="font-bold text-[#5865f2] bg-[#5865f2]/10 dark:bg-[#5865f2]/20 border border-[#5865f2]/20 px-2 py-0.5 rounded">
                      {selectedMappingTarget.variationName}
                    </span>
                  </div>
                )}
                {selectedMappingTarget.sellerSku && !selectedMappingTarget.sellerSku.startsWith('NAME::') && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Mã SKU Shopee:</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300 font-semibold">
                      {selectedMappingTarget.sellerSku}
                    </span>
                  </div>
                )}
              </div>

              {/* Internal Variant Selector with Quick Create Header Action */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Chọn biến thể SKU kho nội bộ tương ứng *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickCreateOpen(!isQuickCreateOpen)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5865f2] hover:text-[#4752c4] dark:text-[#7983f5] hover:underline cursor-pointer"
                  >
                    <Plus size={13} />
                    {isQuickCreateOpen ? 'Ẩn tạo nhanh' : 'Thêm mới nhanh'}
                  </button>
                </div>

                <Select
                  value={selectedInternalVariantId}
                  onChange={(val: any) => setSelectedInternalVariantId(val)}
                  options={[
                    { value: '', label: '-- Chọn biến thể SKU nội bộ --' },
                    ...allInternalVariants.map((iv) => ({
                      value: iv.id,
                      label: `[${iv.sku}] ${iv.productName} - ${iv.variantName} (${iv.unit || 'cái'})`,
                    })),
                  ]}
                  placeholder="-- Chọn biến thể SKU nội bộ --"
                  searchable={true}
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                  emptyAction={{
                    label: 'Thêm mới nhanh biến thể này',
                    onClick: (term) => {
                      setIsQuickCreateOpen(true);
                      if (term) {
                        setQuickCreateForm((prev) => ({
                          ...prev,
                          name: term,
                          sku: term.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase(),
                        }));
                      }
                    },
                  }}
                  footerAction={{
                    label: '+ Thêm mới nhanh biến thể SKU kho',
                    onClick: () => setIsQuickCreateOpen(true),
                  }}
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Nhiều sản phẩm khác tên trên Shopee đều có thể trỏ về cùng một SKU này để gom tồn kho.
                </p>
              </div>

              {/* Quick Create Variant Subform */}
              {isQuickCreateOpen && (
                <div className="p-4 bg-gradient-to-b from-[#5865f2]/5 to-transparent dark:from-[#5865f2]/10 rounded-lg border-2 border-[#5865f2]/30 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-100 dark:border-indigo-900/40">
                    <span className="text-xs font-bold text-[#5865f2] dark:text-indigo-400 flex items-center gap-1.5">
                      <Plus size={14} /> Thêm nhanh SKU kho nội bộ
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsQuickCreateOpen(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-[11px] cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Tên sản phẩm kho *
                      </label>
                      <input
                        type="text"
                        required
                        value={quickCreateForm.name}
                        onChange={(e) =>
                          setQuickCreateForm({ ...quickCreateForm, name: e.target.value })
                        }
                        placeholder="VD: Ensure Gold Lon Đơn"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Mã SKU nội bộ *
                        </label>
                        <input
                          type="text"
                          required
                          value={quickCreateForm.sku}
                          onChange={(e) =>
                            setQuickCreateForm({
                              ...quickCreateForm,
                              sku: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="VD: ENS_GOLD_1"
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white uppercase focus:outline-none focus:border-[#5865f2]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Tên phân loại
                        </label>
                        <input
                          type="text"
                          value={quickCreateForm.variantName || 'Mặc định'}
                          onChange={(e) =>
                            setQuickCreateForm({
                              ...quickCreateForm,
                              variantName: e.target.value,
                            })
                          }
                          placeholder="Mặc định / 7 Lon"
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Giá vốn COGS (VND)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={quickCreateForm.costPrice}
                          onChange={(e) =>
                            setQuickCreateForm({
                              ...quickCreateForm,
                              costPrice: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Giá bán (VND)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={quickCreateForm.sellPrice}
                          onChange={(e) =>
                            setQuickCreateForm({
                              ...quickCreateForm,
                              sellPrice: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsQuickCreateOpen(false)}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={isCreatingQuickVariant}
                        onClick={handleQuickCreateVariant}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#5865f2] hover:bg-[#4752c4] rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {isCreatingQuickVariant ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Plus size={13} />
                        )}
                        Lưu & Chọn ngay
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Multiplier / Quy cách đóng gói */}
              <div className="p-3.5 bg-amber-500/10 dark:bg-amber-500/10 rounded-lg border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    Hệ số nhân quy đổi sản phẩm (Multiplier) *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      required
                      value={mappingMultiplier}
                      onChange={(e) =>
                        setMappingMultiplier(Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      className="w-18 px-2 py-1 text-xs font-mono font-bold text-center bg-white dark:bg-[#131720] border border-amber-400 dark:border-amber-700 rounded-lg text-amber-900 dark:text-amber-200 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      sản phẩm / đơn
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                  💡 <strong>Quy tắc trừ kho:</strong> Khách đặt 1 đơn trên Shopee → Kho trừ{' '}
                  <strong>{mappingMultiplier}</strong> sản phẩm. Khách đặt 2 đơn → Kho trừ{' '}
                  <strong>{mappingMultiplier * 2}</strong> sản phẩm. (Ví dụ: &quot;Combo 2 thùng&quot; điền 2;
                  &quot;3 thùng&quot; điền 3).
                </p>
              </div>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                variant="secondary"
                onClick={() => setIsMapModalOpen(false)}
              >
                Hủy
              </ModalButton>
              <ModalButton variant="primary" type="submit">
                Xác nhận liên kết
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 4: BULK GROUP MULTIPLE LISTINGS TO 1 WAREHOUSE SKU */}
      {isBulkMapModalOpen && (
        <Modal
          isOpen={isBulkMapModalOpen}
          onClose={() => setIsBulkMapModalOpen(false)}
          title={`Gom ${selectedListingIds.length} sản phẩm sàn về CÙNG 1 SKU kho`}
          subtitle="Ánh xạ nhiều phân loại Shopee khác nhau về cùng 1 SKU nội bộ quản lý"
          icon={Layers}
          maxWidth="w-[92vw] max-w-4xl"
        >
          <form onSubmit={handleSaveBulkMapping} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Chọn biến thể SKU kho nội bộ chung cho tất cả các sản phẩm này *
                </label>
                <Select
                  value={bulkMapTargetVariantId}
                  onChange={(val: any) => setBulkMapTargetVariantId(val)}
                  options={[
                    { value: '', label: '-- Chọn biến thể SKU nội bộ chung --' },
                    ...allInternalVariants.map((iv) => ({
                      value: iv.id,
                      label: `[${iv.sku}] ${iv.productName} - ${iv.variantName} (${iv.unit || 'cái'})`,
                    })),
                  ]}
                  placeholder="-- Chọn biến thể SKU nội bộ chung --"
                  searchable={true}
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
                {allInternalVariants.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Chưa có biến thể SKU kho nào trong hệ thống. Vui lòng tạo sản phẩm trước.
                  </p>
                )}
              </div>

              {/* Table of selected items with individual multipliers */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-50/80 dark:bg-gray-800/40 p-2.5 text-xs font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                  Danh sách sản phẩm sàn được gán & Hệ số quy đổi tương ứng:
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {mappings
                    .filter((m) => selectedListingIds.includes(m.id))
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-gray-50/70 dark:hover:bg-[#1c212d] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {item.productName || item.listingName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400">
                              Shop: {item.shop?.code || item.shopId}
                            </span>
                            {item.variationName && (
                              <span className="text-[10px] text-[#5865f2] font-semibold">
                                Phân loại: {item.variationName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            Hệ số:
                          </span>
                          <input
                            type="number"
                            min="1"
                            required
                            value={bulkMultipliers[item.id] || item.multiplier || 1}
                            onChange={(e) =>
                              setBulkMultipliers({
                                ...bulkMultipliers,
                                [item.id]: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            className="w-16 px-2 py-1 text-xs font-mono font-bold text-center bg-white dark:bg-[#131720] border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 text-[11px] text-blue-800 dark:text-blue-300">
                Sau khi xác nhận, toàn bộ đơn hàng của các sản phẩm này (kể cả các đơn đã import) sẽ được tự động gom về SKU kho đã chọn và tính toán số lượng tồn kho theo đúng hệ số quy đổi đã thiết lập.
              </div>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                variant="secondary"
                onClick={() => setIsBulkMapModalOpen(false)}
              >
                Hủy
              </ModalButton>
              <ModalButton variant="primary" type="submit">
                Xác nhận gom về 1 SKU kho
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL: VIEW SHOPEE VARIANTS MAPPED TO INTERNAL SKU */}
      {isShopeeVariantsModalOpen && selectedVariantForShopee && (
        <Modal
          isOpen={isShopeeVariantsModalOpen}
          onClose={() => setIsShopeeVariantsModalOpen(false)}
          title={`Biến thể Shopee liên kết SKU: ${selectedVariantForShopee.sku}`}
          subtitle={`Sản phẩm kho: ${selectedProductForShopee?.name || ''} • Biến thể: ${selectedVariantForShopee.name}`}
          icon={Store}
          maxWidth="w-[94vw] max-w-5xl"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-4">
              {/* Variant Info Banner */}
              <div className="p-3 bg-gray-50 dark:bg-[#181b22] rounded border border-gray-200 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-400">Mã SKU kho nội bộ:</span>
                  <div className="font-mono font-bold text-sm text-[#5865f2] mt-0.5">
                    {selectedVariantForShopee.sku}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Tên biến thể:</span>
                  <div className="font-medium text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                    {selectedVariantForShopee.name}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Barcode:</span>
                  <div className="font-mono font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                    {selectedVariantForShopee.barcode || '--'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Liên kết Shopee:</span>
                  <div className="font-bold text-gray-900 dark:text-white mt-0.5">
                    {selectedVariantForShopee.listingMappings?.length || 0} phân loại
                  </div>
                </div>
              </div>

              {/* Mapped Shopee Listings Table */}
              <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
                <div className="p-2.5 bg-gray-50/80 dark:bg-[#14151a] border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span>Danh sách phân loại hàng Shopee đang trỏ về SKU kho này:</span>
                  <button
                    type="button"
                    onClick={() => setIsAddShopeeLinkOpen((prev) => !prev)}
                    className="text-xs text-[#5865f2] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>{isAddShopeeLinkOpen ? 'Đóng form gán' : 'Thêm liên kết Shopee'}</span>
                  </button>
                </div>

                {/* Inline Quick Add Shopee Link Form */}
                {isAddShopeeLinkOpen && (
                  <form
                    onSubmit={handleAddShopeeLinkDirect}
                    className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/40 space-y-2.5"
                  >
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      Gán sản phẩm sàn Shopee vào SKU này:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Chọn sản phẩm / phân loại sàn Shopee *
                        </label>
                        <Select
                          value={selectedShopeeListingToAdd}
                          onChange={(val: any) => setSelectedShopeeListingToAdd(val)}
                          options={[
                            { value: '', label: '-- Chọn sản phẩm Shopee cần gán --' },
                            ...mappings.map((m) => {
                              const isAlreadyMapped = selectedVariantForShopee?.listingMappings?.some(
                                (lm: any) => lm.id === m.id
                              );
                              return {
                                value: m.id,
                                label: `${m.shop?.code || 'Shopee'} • ${m.productName || m.listingName || 'SP'} ${
                                  m.variationName ? `(${m.variationName})` : ''
                                } - SKU sàn: ${m.sellerSku || 'Không SKU'}${
                                  isAlreadyMapped ? ' [Đã liên kết]' : !m.variant ? ' [Chưa gán]' : ''
                                }`,
                                disabled: isAlreadyMapped,
                              };
                            }),
                          ]}
                          placeholder="-- Chọn sản phẩm Shopee --"
                          searchable={true}
                          size="sm"
                          className="w-full"
                          menuWidth="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Hệ số trừ kho (VD: 2)
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={addShopeeLinkMultiplier}
                          onChange={(e) =>
                            setAddShopeeLinkMultiplier(
                              Math.max(1, parseInt(e.target.value, 10) || 1)
                            )
                          }
                          className="w-full px-2 py-1.5 text-xs font-mono font-bold text-center bg-white dark:bg-[#131720] border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setIsAddShopeeLinkOpen(false)}
                      >
                        Hủy
                      </Button>
                      <Button type="submit" variant="default" size="xs">
                        Xác nhận gán SKU
                      </Button>
                    </div>
                  </form>
                )}

                {(!selectedVariantForShopee.listingMappings ||
                  selectedVariantForShopee.listingMappings.length === 0) ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    <Store className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="font-medium text-gray-600 dark:text-gray-300">
                      Chưa có biến thể Shopee nào được liên kết với SKU này.
                    </p>
                    <p className="mt-1 text-gray-400">
                      Nhấn &quot;Thêm liên kết Shopee&quot; ở trên để gán phân loại sàn về biến thể này ngay lập tức.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[380px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-[#131720] text-gray-500 dark:text-gray-400 text-[11px] uppercase font-semibold border-b border-gray-200 dark:border-gray-800">
                        <tr>
                          <th className="py-2.5 px-3 w-[120px]">Gian hàng</th>
                          <th className="py-2.5 px-3 w-[180px]">Mã SKU Shopee</th>
                          <th className="py-2.5 px-3">Tên sản phẩm Shopee</th>
                          <th className="py-2.5 px-3 w-[200px]">Phân loại trên sàn</th>
                          <th className="py-2.5 px-3 w-[120px] text-center">Hệ số trừ kho</th>
                          <th className="py-2.5 px-3 w-[130px] text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                        {selectedVariantForShopee.listingMappings.map((lm: any) => (
                          <tr key={lm.id} className="hover:bg-gray-50/80 dark:hover:bg-[#1c212d]/60 transition-colors">
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/60">
                                {lm.shop?.code || lm.shop?.name || 'Shopee'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-gray-900 dark:text-white">
                              {lm.sellerSku}
                            </td>
                            <td className="py-3 px-3 text-gray-700 dark:text-gray-300 font-medium">
                              {lm.productName || 'Sản phẩm Shopee'}
                            </td>
                            <td className="py-3 px-3">
                              {lm.variationName ? (
                                <span className="text-[#5865f2] font-semibold">
                                  {lm.variationName}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">Mặc định</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                                lm.multiplier > 1
                                  ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                x{lm.multiplier || 1}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() => {
                                    setIsShopeeVariantsModalOpen(false);
                                    handleOpenMapModal(lm);
                                  }}
                                  className="text-xs gap-1"
                                  title="Đổi SKU kho đích"
                                >
                                  <LinkIcon size={12} />
                                  <span>Đổi</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={async () => {
                                    if (!window.confirm(`Hủy liên kết mã Shopee "${lm.sellerSku}" với SKU này?`)) return;
                                    try {
                                      await productsApi.deleteMapping(lm.id);
                                      toast.success('Đã hủy liên kết SKU Shopee!');
                                      setSelectedVariantForShopee((prev: any) => ({
                                        ...prev,
                                        listingMappings: (prev.listingMappings || []).filter(
                                          (m: any) => m.id !== lm.id
                                        ),
                                      }));
                                      loadProducts();
                                      loadMappings();
                                    } catch (err: any) {
                                      toast.error('Lỗi hủy liên kết', err.message);
                                    }
                                  }}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
                                  title="Hủy liên kết biến thể này"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Quick Link More Section */}
              <div className="p-3 rounded bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between gap-3">
                <div className="leading-relaxed">
                  <span className="font-semibold">Mẹo quản lý tồn:</span> Bạn có thể gom nhiều phân loại Shopee khác nhau hoặc các combo (x2, x3) về cùng SKU kho này để trừ tồn kho chính xác.
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsShopeeVariantsModalOpen(false);
                    setActiveTab('MAPPINGS');
                  }}
                  className="shrink-0 text-xs gap-1 border-blue-300 dark:border-blue-700 text-[#5865f2]"
                >
                  <LinkIcon size={13} />
                  <span>Quản lý Mapping SKU</span>
                </Button>
              </div>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                variant="primary"
                onClick={() => setIsShopeeVariantsModalOpen(false)}
              >
                Đóng
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}

      {/* MODAL: VIEW PRODUCT DETAIL & ALL ITS SHOPEE VARIANTS */}
      {isProductDetailModalOpen && selectedProductForDetail && (
        <Modal
          isOpen={isProductDetailModalOpen}
          onClose={() => setIsProductDetailModalOpen(false)}
          title={`Chi tiết sản phẩm: ${selectedProductForDetail.name}`}
          subtitle={`Mã sản phẩm: ${selectedProductForDetail.code || selectedProductForDetail.sku || '--'} • Danh mục SKU nội bộ & Ánh xạ Shopee`}
          icon={Package}
          maxWidth="w-[94vw] max-w-6xl"
        >
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            <ModalBody className="space-y-4">
              {/* Product Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-gray-50 dark:bg-[#181b22] rounded border border-gray-200 dark:border-gray-800">
                  <span className="text-gray-400">Mã SKU cha:</span>
                  <div className="font-mono font-bold text-sm text-[#5865f2] mt-0.5">
                    {selectedProductForDetail.code || selectedProductForDetail.sku || '--'}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-[#181b22] rounded border border-gray-200 dark:border-gray-800">
                  <span className="text-gray-400">Số lượng biến thể:</span>
                  <div className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">
                    {selectedProductForDetail.variants?.length || 0} biến thể
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-[#181b22] rounded border border-gray-200 dark:border-gray-800">
                  <span className="text-gray-400">Tổng SKU Shopee map:</span>
                  <div className="font-bold text-sm text-orange-600 dark:text-orange-400 mt-0.5">
                    {(selectedProductForDetail.variants || []).reduce(
                      (acc: number, v: any) => acc + (v.listingMappings?.length || 0),
                      0
                    )}{' '}
                    phân loại
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-[#181b22] rounded border border-gray-200 dark:border-gray-800">
                  <span className="text-gray-400">Trạng thái:</span>
                  <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                    <CheckCircle size={14} /> Đang hoạt động
                  </div>
                </div>
              </div>

              {selectedProductForDetail.description && (
                <div className="p-3 bg-gray-50/60 dark:bg-[#181b22]/60 rounded border border-gray-200/60 dark:border-gray-800/60 text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">Mô tả: </span>
                  {selectedProductForDetail.description}
                </div>
              )}

              {/* Variants and mapped Shopee listings */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Danh sách biến thể nội bộ & Ánh xạ SKU Shopee
                </div>

                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {(selectedProductForDetail.variants || []).map((variant: any, idx: number) => {
                    const mappingsCount = variant.listingMappings?.length || 0;
                    return (
                      <div
                        key={variant.id || idx}
                        className="bg-white dark:bg-[#161b26] rounded border border-gray-200 dark:border-gray-800 p-3.5 space-y-3 shadow-xs"
                      >
                        {/* Variant header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-100 dark:border-gray-800/80">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center font-bold text-xs">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-2">
                                <span>{variant.name}</span>
                                <span className="font-mono text-[11px] font-bold text-[#5865f2] bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200/50">
                                  SKU: {variant.sku}
                                </span>
                              </div>
                              {variant.barcode && (
                                <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                                  Barcode: {variant.barcode}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <div>
                              <span className="text-gray-400">Giá vốn: </span>
                              <span className="font-semibold text-amber-600 dark:text-amber-400">
                                {formatCurrency(variant.costPrice || 0)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400">Giá bán: </span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(variant.sellingPrice || 0)}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                setIsProductDetailModalOpen(false);
                                handleOpenShopeeVariantsModal(selectedProductForDetail, variant);
                              }}
                              className="gap-1 text-xs"
                            >
                              <Store size={12} className="text-[#5865f2]" />
                              <span>Quản lý Shopee ({mappingsCount})</span>
                            </Button>
                          </div>
                        </div>

                        {/* Mapped Shopee Variants table */}
                        <div>
                          <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Store size={12} className="text-orange-500" />
                              Các biến thể Shopee trỏ về biến thể này ({mappingsCount}):
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setIsProductDetailModalOpen(false);
                                handleOpenShopeeVariantsModal(selectedProductForDetail, variant);
                              }}
                              className="text-[11px] text-[#5865f2] hover:underline cursor-pointer"
                            >
                              + Thêm liên kết Shopee
                            </button>
                          </div>

                          {mappingsCount === 0 ? (
                            <div className="py-3 px-4 rounded bg-gray-50/60 dark:bg-[#12141a] border border-dashed border-gray-200 dark:border-gray-800 text-[11px] text-gray-400 text-center flex items-center justify-center gap-2">
                              <AlertTriangle size={13} className="text-amber-500/70" />
                              <span>Chưa có phân loại Shopee nào liên kết với SKU này.</span>
                            </div>
                          ) : (
                            <div className="rounded border border-gray-200/80 dark:border-gray-800 overflow-hidden">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-gray-50/80 dark:bg-[#131720] text-gray-500 text-[10px] uppercase font-semibold border-b border-gray-200/80 dark:border-gray-800">
                                    <th className="py-2 px-3">Shop</th>
                                    <th className="py-2 px-3">Mã SKU Shopee</th>
                                    <th className="py-2 px-3">Tên sản phẩm Shopee</th>
                                    <th className="py-2 px-3">Phân loại hàng trên sàn</th>
                                    <th className="py-2 px-2 text-center">Hệ số</th>
                                    <th className="py-2 px-3 text-center">Thao tác</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-[11px]">
                                  {variant.listingMappings.map((lm: any) => (
                                    <tr key={lm.id} className="hover:bg-gray-50/50 dark:hover:bg-[#1d222e]">
                                      <td className="py-2 px-3">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/50">
                                          {lm.shop?.code || lm.shop?.name || 'Shopee'}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-white">
                                        {lm.sellerSku}
                                      </td>
                                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                                        {lm.productName || '--'}
                                      </td>
                                      <td className="py-2 px-3 text-[#5865f2] font-semibold">
                                        {lm.variationName || (
                                          <span className="text-gray-400 font-normal italic">Mặc định</span>
                                        )}
                                      </td>
                                      <td className="py-2 px-2 text-center">
                                        <span className="font-mono font-bold text-amber-600">
                                          x{lm.multiplier || 1}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setIsProductDetailModalOpen(false);
                                            handleOpenMapModal(lm);
                                          }}
                                          className="text-[11px] text-[#5865f2] hover:underline mr-2"
                                        >
                                          Sửa
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                variant="primary"
                onClick={() => setIsProductDetailModalOpen(false)}
              >
                Đóng
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}

      {/* Product Stock History & Ledger Modal */}
      {selectedVariantForHistory && (
        <ProductHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          variantId={selectedVariantForHistory.id}
          sku={selectedVariantForHistory.sku}
          productName={selectedVariantForHistory.productName}
        />
      )}
    </div>
  );
};
