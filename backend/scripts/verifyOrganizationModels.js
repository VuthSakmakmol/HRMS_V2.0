import {
    connectDatabase,
    disconnectDatabase,
} from "../src/config/database.js"

import Company from "../src/modules/organization/models/Company.js"
import Branch from "../src/modules/organization/models/Branch.js"

async function verifyOrganizationModels() {
    try {
        await connectDatabase()

        await Company.createIndexes()
        await Branch.createIndexes()

        const companyIndexes = await Company.collection.indexes()
        const branchIndexes = await Branch.collection.indexes()

        console.log("\n[organization] Company indexes")

        console.table(
            companyIndexes.map((index) => ({
                name: index.name,
                key: JSON.stringify(index.key),
                unique: Boolean(index.unique),
            })),
        )

        console.log("\n[organization] Branch indexes")

        console.table(
            branchIndexes.map((index) => ({
                name: index.name,
                key: JSON.stringify(index.key),
                unique: Boolean(index.unique),
            })),
        )

        console.log(
            "\n[organization] Company and Branch models verified successfully.",
        )
    } finally {
        await disconnectDatabase()
    }
}

verifyOrganizationModels()
    .then(() => {
        process.exitCode = 0
    })
    .catch((error) => {
        console.error("\n[organization] verification failed:")
        console.error(error)

        process.exitCode = 1
    })