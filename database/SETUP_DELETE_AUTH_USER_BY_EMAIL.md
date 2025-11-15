# Setup: Delete Auth User by Email Function

This SQL function allows you to delete orphaned authentication users by email address. This is useful when a user profile has been deleted but the auth user record still exists, preventing re-registration with the same email.

## When to Use This

- A user profile was deleted from `jobseeker_profiles` or `employer_profiles`
- The corresponding auth user in `auth.users` was not deleted (orphaned)
- Someone tries to register again with the same email and gets "User already registered" error
- You need to clean up the orphaned auth user to allow re-registration

## Setup Instructions

1. **Open Supabase SQL Editor**
   - Go to your Supabase Dashboard
   - Navigate to SQL Editor
   - Click "New Query"

2. **Copy and Run the SQL Script**
   - Copy the contents of `database/delete_auth_user_by_email.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute

3. **Verify the Function**
   - The function should be created without errors
   - You can test it by running:
     ```sql
     SELECT delete_auth_user_by_email('user@example.com');
     ```

## Usage

### From SQL Editor (Admin)
```sql
-- Delete an orphaned auth user by email
SELECT delete_auth_user_by_email('deleted-user@example.com');
```

### From Application Code (Future Enhancement)
This function can be called from the application when detecting orphaned auth users:
```javascript
const { data, error } = await supabase.rpc('delete_auth_user_by_email', {
  user_email: 'deleted-user@example.com'
});
```

## Important Notes

- **Permissions**: This function requires `SECURITY DEFINER` privileges to access `auth.users`
- **Service Role**: If the function fails with permission errors, you may need to use the Supabase Admin API or an Edge Function instead
- **Manual Alternative**: You can also manually delete orphaned auth users from the Supabase Dashboard:
  - Go to Authentication > Users
  - Search for the email address
  - Click the user and select "Delete User"

## Troubleshooting

### Error: "Insufficient privileges"
- The function may not have proper permissions to delete from `auth.users`
- Try using the Supabase Admin API or manually delete from the Dashboard
- Consider creating an Edge Function with service role access

### Error: "Function does not exist"
- Make sure you've run the SQL script in the Supabase SQL Editor
- Check that the function name is correct: `delete_auth_user_by_email`

### User Still Exists After Running Function
- Check if the email address is correct (case-sensitive)
- Verify the user actually exists in `auth.users` table
- Check Supabase logs for any errors

