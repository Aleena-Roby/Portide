"""
QR Code Generation Service for PORTIDE Digital Gate Pass.
Generates safe, secure, vector SVG QR codes with no sensitive credentials or tokens.
"""

import base64
import struct
import zlib
import qrcode
import qrcode.image.svg


def generate_verification_payload(pass_number: str, verification_code: str) -> str:
    """
    Constructs a safe, non-sensitive QR payload reference.
    Contains ONLY the Gate Pass ID and cryptographic verification reference.
    Strictly NO passwords, JWTs, or sensitive personal information.
    """
    return f"PORTIDE-GP:{pass_number}:{verification_code}"


def generate_qr_svg(payload: str) -> str:
    """
    Generates a clean, scalable vector SVG string for the QR code.
    Can be rendered inline in HTML and React UI.
    """
    factory = qrcode.image.svg.SvgPathImage
    img = qrcode.make(payload, image_factory=factory, box_size=10, border=2)
    return img.to_string(encoding='unicode')


def generate_qr_png_bytes(payload: str, scale: int = 6, border: int = 4) -> bytes:
    """
    Generates standard, portable PNG image bytes for the QR code without external C/PIL dependencies.
    Produces high-fidelity, universally email-client compatible monochrome PNG raster data.
    """
    qr = qrcode.QRCode(border=0)
    qr.add_data(payload)
    qr.make(fit=True)
    matrix = qr.modules
    matrix_h = len(matrix)
    matrix_w = len(matrix[0])

    img_w = (matrix_w + 2 * border) * scale
    img_h = (matrix_h + 2 * border) * scale

    # Build scanlines with PNG filter byte 0 (None)
    raw = bytearray()
    for y in range(img_h):
        raw.append(0)  # filter type 0: None
        my = (y // scale) - border
        for x in range(img_w):
            mx = (x // scale) - border
            if 0 <= my < matrix_h and 0 <= mx < matrix_w and matrix[my][mx]:
                raw.append(0x00)  # black QR module
            else:
                raw.append(0xFF)  # white quiet zone / background

    def png_chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack('>I', len(data))
            + tag
            + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    # IHDR: width, height, 8-bit depth, grayscale (color type 0), deflate compression 0, filter 0, non-interlaced 0
    ihdr_data = struct.pack('>IIBBBBB', img_w, img_h, 8, 0, 0, 0, 0)
    idat_data = zlib.compress(bytes(raw), level=9)

    return (
        b'\x89PNG\r\n\x1a\n'
        + png_chunk(b'IHDR', ihdr_data)
        + png_chunk(b'IDAT', idat_data)
        + png_chunk(b'IEND', b'')
    )


def generate_qr_png_base64(payload: str, scale: int = 6, border: int = 4) -> str:
    """
    Generates a ready-to-embed data URI for the QR code: 'data:image/png;base64,...'
    Directly compatible with modern email rendering engines, HTML web views, and mobile viewports.
    """
    png_bytes = generate_qr_png_bytes(payload, scale=scale, border=border)
    b64_str = base64.b64encode(png_bytes).decode('ascii')
    return f"data:image/png;base64,{b64_str}"

