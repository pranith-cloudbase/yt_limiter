from __future__ import annotations

from io import BytesIO

from docx import Document
from pypdf import PdfReader


class UnsupportedFileTypeError(Exception):
    pass


def parse_file_to_text(filename: str, content: bytes) -> str:
    lower_name = filename.lower()

    if lower_name.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")

    if lower_name.endswith(".pdf"):
        reader = PdfReader(BytesIO(content))
        chunks = []
        for page in reader.pages:
            chunks.append(page.extract_text() or "")
        return "\n".join(chunks)

    if lower_name.endswith(".docx"):
        doc = Document(BytesIO(content))
        return "\n".join([paragraph.text for paragraph in doc.paragraphs])

    raise UnsupportedFileTypeError("Only PDF, DOCX, and TXT are supported")
