import os
import uuid
import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/uploads", tags=["Uploads"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB = 10


class UploadResponse(BaseModel):
    url: str


def _use_cloudinary() -> bool:
    from app.core.config import settings
    return bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY)


@router.post("/image", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes (JPEG, PNG, WebP, GIF)")

    content = await file.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"La imagen no puede superar {MAX_SIZE_MB} MB")

    if _use_cloudinary():
        import cloudinary
        import cloudinary.uploader
        from app.core.config import settings
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
        )
        result = cloudinary.uploader.upload(
            io.BytesIO(content),
            folder="rifaya",
            resource_type="image",
        )
        return UploadResponse(url=result["secure_url"])

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "image.jpg")[1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(content)
    return UploadResponse(url=f"/uploads/{filename}")
