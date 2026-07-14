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

const branchContactSchema = new Schema(
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
    },
    {
        _id: false,
    },
)

const branchAddressSchema = new Schema(
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

const branchSchema = new Schema(
    {
        companyId: {
            type: Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },

        code: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 30,
            match: /^[A-Z0-9_-]+$/,
            set: normalizeCode,
        },

        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 160,
            set: normalizeText,
        },

        shortName: {
            type: String,
            trim: true,
            maxlength: 60,
            set: normalizeText,
            default: "",
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
            default: "ACTIVE",
            required: true,
        },

        isHeadOffice: {
            type: Boolean,
            default: false,
            required: true,
        },

        timezone: {
            type: String,
            trim: true,
            default: "Asia/Phnom_Penh",
            required: true,
        },

        contact: {
            type: branchContactSchema,
            default: () => ({}),
        },

        address: {
            type: branchAddressSchema,
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
        collection: "branches",
        timestamps: true,
        versionKey: false,
    },
)

branchSchema.index(
    { companyId: 1, code: 1 },
    {
        unique: true,
        name: "uq_branch_company_code",
    },
)

branchSchema.index(
    { companyId: 1, status: 1, name: 1 },
    {
        name: "idx_branch_company_status_name",
    },
)

branchSchema.index(
    { companyId: 1, isHeadOffice: 1 },
    {
        unique: true,
        partialFilterExpression: {
            isHeadOffice: true,
        },
        name: "uq_company_single_head_office",
    },
)

branchSchema.set("toJSON", {
    virtuals: true,

    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id

        return returnedObject
    },
})

const Branch =
    mongoose.models.Branch || mongoose.model("Branch", branchSchema)

export default Branch