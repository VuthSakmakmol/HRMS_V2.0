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

const communeSchema = new Schema(
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

        districtId: {
            type: Schema.Types.ObjectId,
            ref: "District",
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
        collection: "location_communes",
        timestamps: true,
        versionKey: false,
    },
)

communeSchema.index(
    {
        districtId: 1,
        code: 1,
    },
    {
        unique: true,
        name: "uq_location_commune_district_code",
    },
)

communeSchema.index(
    {
        countryId: 1,
        provinceId: 1,
        districtId: 1,
        status: 1,
        name: 1,
    },
    {
        name: "idx_location_commune_parent_status_name",
    },
)

communeSchema.set("toJSON", {
    virtuals: true,

    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id

        return returnedObject
    },
})

const Commune =
    mongoose.models.Commune || mongoose.model("Commune", communeSchema)

export default Commune
