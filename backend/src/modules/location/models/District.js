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

const districtSchema = new Schema(
    {
        countryId: {
            type: Schema.Types.ObjectId,
            ref: "Country",
            required: true,
        },

        provinceId: {
            type: Schema.Types.ObjectId,
            ref: "Province",
            required: true,
        },

        code: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
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

        description: {
            type: String,
            trim: true,
            maxlength: 500,
            set: normalizeText,
            default: "",
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
            default: "ACTIVE",
            required: true,
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
        collection: "location_districts",
        timestamps: true,
        versionKey: false,
    },
)

districtSchema.index(
    {
        provinceId: 1,
        code: 1,
    },
    {
        unique: true,
        name: "uq_location_district_province_code",
    },
)

districtSchema.index(
    {
        countryId: 1,
        provinceId: 1,
        status: 1,
        name: 1,
    },
    {
        name: "idx_location_district_parent_status_name",
    },
)

districtSchema.set("toJSON", {
    virtuals: true,

    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id

        return returnedObject
    },
})

const District =
    mongoose.models.District || mongoose.model("District", districtSchema)

export default District
