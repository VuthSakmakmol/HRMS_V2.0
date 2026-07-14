export function buildPagination({ page, limit, total }) {
    const safePage = Math.max(1, Number(page) || 1)
    const safeLimit = Math.max(1, Number(limit) || 20)
    const safeTotal = Math.max(0, Number(total) || 0)
    const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeLimit)

    return {
        page: safePage,
        limit: safeLimit,
        total: safeTotal,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrevious: safePage > 1 && totalPages > 0,
    }
}
