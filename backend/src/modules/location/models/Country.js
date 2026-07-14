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

const countrySchema = new Schema(
    {
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

        nationality: {
            type: String,
            trim: true,
            maxlength: 120,
            set: normalizeText,
            default: "",
        },

        phoneCode: {
            type: String,
            trim: true,
            maxlength: 20,
            default: "",
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
        collection: "location_countries",
        timestamps: true,
        versionKey: false,
    },
)

countrySchema.index(
    {
        code: 1,
    },
    {
        unique: true,
        name: "uq_location_country_code",
    },
)

countrySchema.index(
    {
        status: 1,
        name: 1,
    },
    {
        name: "idx_location_country_status_name",
    },
)

countrySchema.set("toJSON", {
    virtuals: true,

    transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id

        return returnedObject
    },
})

const Country = mongoose.models.Country || mongoose.model("Country", countrySchema)

export default Country
