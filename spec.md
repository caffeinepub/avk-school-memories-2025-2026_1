# AVK School Memories 2025-2026

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- Public photo gallery page: visitors can browse/view all uploaded photos in a grid layout
- Admin login page: protected by a fixed admin ID (20695943) and password (koushik@0705)
- Admin dashboard: upload photos with optional title/caption, delete photos
- Photo storage using blob-storage component
- Authorization using a fixed hardcoded admin credential (no user registration)

### Modify
- N/A

### Remove
- N/A

## Implementation Plan
1. Backend:
   - Store photos as blobs with metadata (title, upload date)
   - Admin login: validate fixed credentials (ID: 20695943, password: koushik@0705), return session token
   - Public query: list all photos with public URLs
   - Admin-only mutations: upload photo, delete photo

2. Frontend:
   - Public landing/gallery page showing all photos in a responsive grid
   - Admin login modal/page (ID + password form)
   - Admin panel: upload button (drag-and-drop or file picker), photo management with delete option
   - School branding: "AVK School Memories 2025-2026" header
   - Smooth transitions between public and admin views
