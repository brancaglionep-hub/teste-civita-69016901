-- Drop existing select policy
DROP POLICY IF EXISTS "Usuário pode ver seu próprio profile" ON public.profiles;

-- Create new policy that allows users to see their own profile OR super_admins to see all
CREATE POLICY "Usuário pode ver profile" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id 
  OR has_role(auth.uid(), 'super_admin')
);