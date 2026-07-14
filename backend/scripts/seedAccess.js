import bcrypt from "bcryptjs"

import {
    connectDatabase,
    disconnectDatabase,
} from "../src/config/database.js"

import { env } from "../src/config/env.js"

import Account from "../src/modules/access/models/Account.js"
import Permission from "../src/modules/access/models/Permission.js"
import Role from "../src/modules/access/models/Role.js"
import { PERMISSION_REGISTRY } from "../src/modules/access/permission.registry.js"

function getSeedConfiguration() {
    const loginId = env.SEED_ROOT_LOGIN?.trim().toLowerCase()
    const password = env.SEED_ROOT_PASSWORD
    const displayName =
        env.SEED_ROOT_DISPLAY_NAME?.trim() || "System Super Admin"

    const errors = []

    if (!loginId || loginId.length < 3) {
        errors.push("SEED_ROOT_LOGIN must contain at least 3 characters.")
    }

    if (!password || password.length < 12) {
        errors.push(
            "SEED_ROOT_PASSWORD must contain at least 12 characters.",
        )
    }

    if (errors.length > 0) {
        throw new Error(errors.join("\n"))
    }

    return {
        loginId,
        password,
        displayName,
    }
}

async function seedPermissions() {
    await Permission.bulkWrite(
        PERMISSION_REGISTRY.map((permission) => ({
            updateOne: {
                filter: {
                    code: permission.code,
                },
                update: {
                    $set: {
                        module: permission.module,
                        action: permission.action,
                        name: permission.name,
                        description: permission.description,
                        isSystem: true,
                        isActive: true,
                    },
                    $setOnInsert: {
                        code: permission.code,
                    },
                },
                upsert: true,
            },
        })),
    )

    return Permission.find({
        code: {
            $in: PERMISSION_REGISTRY.map((permission) => permission.code),
        },
        isActive: true,
    }).select("_id")
}

async function seedRootRole(permissionIds) {
    return Role.findOneAndUpdate(
        {
            code: "ROOT_ADMIN",
        },
        {
            $set: {
                code: "ROOT_ADMIN",
                name: "Root Administrator",
                description:
                    "Global system administrator with unrestricted access.",
                scope: "GLOBAL",
                companyId: null,
                permissionIds,
                isSystem: true,
                isActive: true,
            },
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        },
    )
}

async function seedRootAccount(seedConfig, rootRole) {
    let account = await Account.findOne({
        loginId: seedConfig.loginId,
    })

    if (!account) {
        const passwordHash = await bcrypt.hash(seedConfig.password, 12)

        account = await Account.create({
            loginId: seedConfig.loginId,
            displayName: seedConfig.displayName,
            passwordHash,
            status: "ACTIVE",
            isRootAdmin: true,
            roleAssignments: [
                {
                    roleId: rootRole._id,
                    companyId: null,
                    allBranches: true,
                    branchIds: [],
                },
            ],
        })

        return {
            action: "CREATED",
            account,
        }
    }

    const hasRootAssignment = account.roleAssignments.some(
        (assignment) =>
            assignment.roleId.toString() === rootRole._id.toString() &&
            assignment.companyId === null,
    )

    if (!hasRootAssignment) {
        account.roleAssignments.push({
            roleId: rootRole._id,
            companyId: null,
            allBranches: true,
            branchIds: [],
        })
    }

    account.isRootAdmin = true
    account.status = "ACTIVE"

    await account.save()

    return {
        action: "EXISTS",
        account,
    }
}

async function main() {
    const seedConfig = getSeedConfiguration()

    try {
        await connectDatabase()

        const permissions = await seedPermissions()
        const rootRole = await seedRootRole(
            permissions.map((permission) => permission._id),
        )

        const rootAccountResult = await seedRootAccount(
            seedConfig,
            rootRole,
        )

        console.log("\n[seed] Access foundation completed successfully.\n")

        console.table([
            {
                entity: "Permissions",
                action: "SEEDED",
                value: permissions.length,
            },
            {
                entity: "Role",
                action: "SEEDED",
                value: `${rootRole.code} — ${rootRole.name}`,
            },
            {
                entity: "Super Admin",
                action: rootAccountResult.action,
                value: rootAccountResult.account.loginId,
            },
        ])

        console.log(
            "\n[seed] No company and no branch were created by this seed.",
        )
    } finally {
        await disconnectDatabase()
    }
}

main().catch((error) => {
    console.error("\n[seed] Access foundation failed:")
    console.error(error.message)

    process.exitCode = 1
})