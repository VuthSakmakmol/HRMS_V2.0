export function createManpowerPlanStatusOptions(t) {
    return [
        { label: t("manpowerPlan.all"), value: "ALL" },
        { label: t("manpowerPlan.active"), value: "ACTIVE" },
        { label: t("manpowerPlan.inactive"), value: "INACTIVE" },
        { label: t("manpowerPlan.archived"), value: "ARCHIVED" },
    ]
}

export function createMonthOptions(t, locale, includeAll = true) {
    const months = Array.from({ length: 12 }, (_, index) => ({
        label: new Intl.DateTimeFormat(locale, {
            month: "long",
        }).format(new Date(2020, index, 1)),
        value: index + 1,
    }))

    return includeAll
        ? [{ label: t("manpowerPlan.allMonths"), value: "" }, ...months]
        : months
}
