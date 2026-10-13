import { NextRequest } from "next/server";
import { getAuthOrg, jsonResponse, errorResponse } from "@/lib/api/auth";
import { parseTemplate } from "@/lib/document/template-parser";
import { createTemplate, listTemplates } from "@/lib/repositories/template-repository";
import { MAX_DOCUMENT_UPLOAD_BYTES, uploadExceedsLimit } from "@/lib/api/upload-limits";

export async function GET(req: NextRequest) {
  const auth = await getAuthOrg(req);
  const { searchParams } = new URL(req.url);
  return jsonResponse(await listTemplates(auth, searchParams.get("type") || undefined));
}

export async function POST(req: NextRequest) {
  const auth = await getAuthOrg(req);

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "quotation";
    if (!file) return errorResponse("请上传模板文件");
    if (uploadExceedsLimit(file, MAX_DOCUMENT_UPLOAD_BYTES)) {
      return errorResponse("模板文件不能超过 50 MB", 413);
    }

    const name = file.name.replace(/\.(docx|pdf|xlsx|xls)$/i, "");
    const ext = file.name.split(".").pop()?.toLowerCase() || "docx";
    const fileType = ext === "pdf" ? "pdf" : ext === "xlsx" || ext === "xls" ? "xlsx" : "docx";
    const fileData = Buffer.from(await file.arrayBuffer()).toString("base64");

    let parsed;
    try {
      parsed = await parseTemplate(file, file.name);
    } catch {
      return errorResponse("无法解析模板文件，请检查文件格式");
    }

    const row = await createTemplate(auth, {
      type,
      name,
      fileType,
      parsedText: parsed.text.slice(0, 50000),
      structure: parsed.structure,
      placeholders: parsed.placeholders,
      fileData,
    });
    return jsonResponse(row, 201);
  } catch (error) {
    return errorResponse("保存失败: " + (error as Error).message, 500);
  }
}
