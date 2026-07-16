export const LOCATION_ENTITIES = Object.freeze([
    { value: "countries", labelKey: "organization.location.tabs.countries", icon: "pi pi-globe" },
    { value: "provinces", labelKey: "organization.location.tabs.provinces", icon: "pi pi-map" },
    { value: "districts", labelKey: "organization.location.tabs.districts", icon: "pi pi-map-marker" },
    { value: "communes", labelKey: "organization.location.tabs.communes", icon: "pi pi-compass" },
    { value: "villages", labelKey: "organization.location.tabs.villages", icon: "pi pi-home" },
])

export function createLocationStatusOptions(t) {
    return [
        { label: t("organization.location.statusAll"), value: "ALL" },
        { label: t("organization.location.statusActive"), value: "ACTIVE" },
        { label: t("organization.location.statusInactive"), value: "INACTIVE" },
        { label: t("organization.location.statusArchived"), value: "ARCHIVED" },
    ]
}
