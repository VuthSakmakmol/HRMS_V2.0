import mongoose from "mongoose"

const { Schema } = mongoose

function normalizeCode(value) {
    if (typeof value !== "string") {
        return value
    }

    return value.trim().replace(/\s+/g, "_").toUpperCase()
}

function normalizeText(value) {
    if (typeof value !== "string") {
        return value
    }

    return value.trim().replace(/\s+/g, " ")
}

function normalizeUppercase(value) {
    if (typeof value !== "string") {
        return value
    }

    return value.trim().toUpperCase()
}

const companyContactSchema = new Schema(
    {
        email: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: 160,
            default: "",
        },

        phone: {
            type: String,
            trim: true,
            maxlength: 40,
            set: normalizeText,
            default: "",
        },

        website: {
            type: String,
            trim: true,
            maxlength: 250,
            default: "",
        },
    },
    {
        _id: false,
    },
)

const companyAddressSchema = new Schema(
    {
        addressLine1: {
            type: String,
            trim: true,
            maxlength: 200,
            set: normalizeText,
            default: "",
        },

        addressLine2: {
            type: String,
            trim: true,
            maxlength: 200,
            set: normalizeText,
            default: "",
        },

        city: {
            type: String,
            trim: true,
            maxlength: 100,
            set: normalizeText,
            default: "",
        },

        stateProvince: {
            type: String,
            trim: true,
            maxlength: 100,
            set: normalizeText,
            default: "",
        },

        postalCode: {
            type: String,
            trim: true,
            maxlength: 30,
            set: normalizeText,
            default: "",
        },

        countryCode: {
            type: String,
            trim: true,
            minlength: 2,
            maxlength: 2,
            set: normalizeUppercase,
            default: "KH",
        },
    },
    {
        _id: false,
    },
)

const companySchema = new Schema(
    {
        code: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 30,
            match: /^[A-Z0-9_-]+$/,
            set: normalizeCode,
        },

        legalName: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 200,
            set: normalizeText,
        },

        displayName: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 120,
            set: normalizeText,
        },

        registrationNumber: {
            type: String,
            trim: true,
            maxlength: 100,
            set: normalizeText,
            default: "",
        },

        taxNumber: {
            type: String,
            trim: true,
            maxlength: 100,
            set: normalizeText,
            default: "",
        },

        status: {
            type: String,
            enum: ["ACTIVE", "SUSPENDED", "ARCHIVED"],
            default: "ACTIVE",
            required: true,
        },

        settings: {
            defaultLocale: {
                type: String,
                enum: ["en-US", "km-KH"],
                default: "en-US",
                required: true,
            },

            timezone: {
                type: String,
                trim: true,
                default: "Asia/Phnom_Penh",
                required: true,
            },

            currencyCode: {
                type: String,
                trim: true,
                minlength: 3,
                maxlength: 3,
                set: normalizeUppercase,
                default: "USD",
                required: true,
            },

            weekStartsOn: {
                type: Number,
                min: 0,
                max: 6,
                default: 1,
                required: true,
            },
        },

        contact: {
            type: companyContactSchema,
            default: () => ({}),
        },

        address: {
            type: companyAddressSchema,
            default: () => ({}),
        },

        createdByAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },

        updatedByAccountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },
    },
    {
        collection: "companies",
        timestamps: true,
        versionKey: false,
    },
)

companySchema.index(
    { code: 1 },
    {
        unique: true,
        name: "uq_company_code",
    },
)

companySchema.index(
    { status: 1, displayName: 1 },
    {
        name: "idx_company_status_display_name",
    },
)

companySchema.set("toJSON", {
    virtuals: true,

    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id

        return returnedObject
    },
})

const Company =
    mongoose.models.Company || mongoose.model("Company", companySchema)

export default Company