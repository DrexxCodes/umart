import SubCategoryBrowseClient from './client'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; subId: string }>
}) {
  const { id, subId } = await params
  return {
    title: `Browse Sub-category - Umart`,
    description: `Browse products in category ${id} / ${subId}`,
  }
}

export default async function SubCategoryBrowsePage({
  params,
}: {
  params: Promise<{ id: string; subId: string }>
}) {
  const { id, subId } = await params
  return <SubCategoryBrowseClient categoryId={id} subId={subId} />
}
