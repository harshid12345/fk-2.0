CREATE POLICY "Landlords can delete applicants for own properties"
ON public.applicants
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM landlord_properties
  WHERE landlord_properties.id = applicants.property_id
  AND landlord_properties.landlord_id = auth.uid()
));