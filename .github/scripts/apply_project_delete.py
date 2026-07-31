import base64
import hashlib
import zlib
from pathlib import Path

chunk_dir = Path(__file__).with_name("project_delete_chunks")
chunk_paths = sorted(chunk_dir.glob("*.txt"))
if len(chunk_paths) != 10:
    raise RuntimeError(f"Expected 10 Project delete chunks, found {len(chunk_paths)}")
source = b"".join(
    zlib.decompress(base64.b64decode(path.read_text(encoding="utf-8").strip()))
    for path in chunk_paths
)
checksum = hashlib.sha256(source).hexdigest()
if checksum != "4b2ecc600c1ec100abfe5fae1a6f19f2f8ff98a6f92a103f53ec8cc755a421f5":
    raise RuntimeError(f"Project delete implementation payload checksum mismatch: {checksum}")
exec(compile(source.decode("utf-8"), __file__, "exec"))
