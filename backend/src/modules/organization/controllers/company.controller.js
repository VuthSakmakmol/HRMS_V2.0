import { sendList, sendSuccess } from "../../../shared/http/response.js"
import { writeAuditLog } from "../../audit/services/audit.service.js"
import {
    archiveCompany,
    createCompany,
    getCompanyById,
    listCompanies,
    lookupCompanies,
    updateCompany,
} from "../services/company.service.js"

export async function listCompaniesController(req, res) {
    const result = await listCompanies({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendList(req, res, result)
}

export async function lookupCompaniesController(req, res) {
    const items = await lookupCompanies({
        query: req.validatedQuery,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { items },
    })
}

export async function getCompanyController(req, res) {
    const company = await getCompanyById({
        companyId: req.validatedParams.companyId,
        user: req.auth.user,
    })

    return sendSuccess(req, res, {
        data: { company },
    })
}

export async function createCompanyController(req, res) {
    const company = await createCompany({
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.COMPANY",
        action: "CREATE",
        entityType: "Company",
        entityId: company.id,
        after: company,
    })

    return sendSuccess(req, res, {
        statusCode: 201,
        data: { company },
        messageKey: "messages.organization.company.created",
    })
}

export async function updateCompanyController(req, res) {
    const companyId = req.validatedParams.companyId
    const before = await getCompanyById({
        companyId,
        user: req.auth.user,
    })

    const company = await updateCompany({
        companyId,
        payload: req.validatedBody,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.COMPANY",
        action: "UPDATE",
        entityType: "Company",
        entityId: company.id,
        before,
        after: company,
    })

    return sendSuccess(req, res, {
        data: { company },
        messageKey: "messages.organization.company.updated",
    })
}

export async function archiveCompanyController(req, res) {
    const companyId = req.validatedParams.companyId
    const before = await getCompanyById({
        companyId,
        user: req.auth.user,
    })

    const company = await archiveCompany({
        companyId,
        user: req.auth.user,
    })

    await writeAuditLog({
        req,
        user: req.auth.user,
        module: "ORGANIZATION.COMPANY",
        action: "ARCHIVE",
        entityType: "Company",
        entityId: company.id,
        before,
        after: company,
    })

    return sendSuccess(req, res, {
        data: { company },
        messageKey: "messages.organization.company.archived",
    })
}
