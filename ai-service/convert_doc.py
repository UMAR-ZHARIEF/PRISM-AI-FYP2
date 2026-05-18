import markdown
from html2docx import html2docx

with open('PRISM_AI_SRS.md', 'r', encoding='utf-8') as f:
    md_text = f.read()

# Convert markdown to HTML
html_content = markdown.markdown(md_text, extensions=['extra'])

# html2docx usually needs a full html wrapper
full_html = f"<html><body>{html_content}</body></html>"

# Convert HTML to DOCX
buf = html2docx(full_html, title='Software Requirements Specification for PRISM-AI')

with open('PRISM_AI_SRS.docx', 'wb') as f:
    f.write(buf.getvalue())
