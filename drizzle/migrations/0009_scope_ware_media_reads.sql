DROP POLICY IF EXISTS "Authenticated users read Savora ware media" ON storage.objects;

CREATE POLICY "Team members read attached Savora ware media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'savora-ware-media'
  AND (
    private.has_role((select auth.uid()), 'admin'::public.app_role)
    OR (
      private.has_role((select auth.uid()), 'viewer'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.skus s
        WHERE s.ware_media_path = objects.name
      )
    )
  )
);