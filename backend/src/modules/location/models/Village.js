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

const villageSchema = new Schema(
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

        communeId: {
            type: Schema.Types.ObjectId,
            ref: "Commune",
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
        collection: "location_villages",
        timestamps: true,
        versionKey: false,
    },
)

villageSchema.index(
    {
        communeId: 1,
        code: 1,
    },
    {
        unique: true,
        name: "uq_location_village_commune_code",
    },
)

villageSchema.index(
    {
        countryId: 1,
        provinceId: 1,
        districtId: 1,
        communeId: 1,
        status: 1,
        name: 1,
    },
    {
        name: "idx_location_village_parent_status_name",
    },
)

villageSchema.set("toJSON", {
    virtuals: true,

    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id

        return returnedObject
    },
})

const Village =
    mongoose.models.Village || mongoose.model("Village", villageSchema)

export default Village
