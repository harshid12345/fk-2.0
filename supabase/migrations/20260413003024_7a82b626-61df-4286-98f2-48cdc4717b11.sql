ALTER TABLE public.landlord_properties 
ADD COLUMN status text NOT NULL DEFAULT 'seeking' 
CHECK (status IN ('rented', 'seeking'));