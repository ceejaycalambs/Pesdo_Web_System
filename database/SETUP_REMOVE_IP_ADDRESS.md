# Remove IP Address Column from Logging Tables

This guide explains how to remove the `ip_address` column from the `activity_log` and `login_log` tables in Supabase.

## Steps

1. Open the Supabase SQL Editor
2. Copy and paste the contents of `database/remove_ip_address_column.sql`
3. Run the script
4. The script will:
   - Drop the `ip_address` column from `activity_log` table
   - Drop the `ip_address` column from `login_log` table
   - Update the `insert_activity_log` RPC function to remove the `ip_address` parameter

## What This Does

- Removes the IP Address column from both logging tables
- Updates the RPC function to no longer accept or store IP addresses
- The frontend code has already been updated to stop displaying IP addresses

## Notes

- This operation is irreversible - IP address data will be permanently deleted
- Make sure to backup your database if you need to preserve IP address data
- The frontend will continue to work even if the column still exists (it just won't be displayed)

