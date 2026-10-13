import { NextRequest, NextResponse } from "next/server";
import { AuthError, errorResponse, getAuthOrg } from "@/lib/api/auth";
import { getGeneratedDocumentDownload } from "@/lib/repositories/generated-document-repository";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthOrg(req);
    const { id } = await params;
    const document = await getGeneratedDocumentDownload(auth, id);

    if (!document) return errorResponse("Generated document not found", 404);

    return new NextResponse(new Uint8Array(document.fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": document.fileMimeType,
        "Content-Length": String(document.fileSize),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(document.fileName)}"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse("Failed to download generated document: " + (error as Error).message, 500);
  }
}
