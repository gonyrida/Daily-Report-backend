// src/integrations/supabase/server.js
// Server-side Supabase integration for backend

const { createClient } = require('@supabase/supabase-js');
const env = require('../../config/env');

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL || 'https://ldwvgxpyeicdelcfygqd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkd3ZneHB5ZWljZGVsY2Z5Z3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjEyMTksImV4cCI6MjA4ODIzNzIxOX0.KfsMyaXqKwewsccdPDLZ5me0JIs0fP7QBVK7cL0YqQU';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Upload an image to Supabase storage
 */
const uploadImageToSupabase = async (file, path, options = {}) => {
  try {
    // Handle both Buffer and File objects
    const fileName = file.name || 'image.jpg';
    const contentType = file.type || 'image/jpeg';
    console.log(`DEBUG: Uploading to Supabase - Path: ${path}, File: ${fileName}`);
    
    const { data, error } = await supabase.storage
      .from('daily-report')
      .upload(path, file, {
        contentType: contentType,
        upsert: true,
        ...options
      });
    
    if (error) {
      console.error('DEBUG: Supabase upload error:', error);
      return { success: false, error: error.message };
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('daily-report')
      .getPublicUrl(data.path);
    
    console.log(`DEBUG: Upload successful - Public URL: ${publicUrl}`);
    
    return {
      success: true,
      data,
      publicUrl,
      path: data.path
    };
    
  } catch (error) {
    console.error('DEBUG: Upload error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a file from Supabase storage
 */
const deleteFileFromSupabase = async (path) => {
  try {
    console.log(`DEBUG: Deleting from Supabase - Path: ${path}`);
    
    const { data, error } = await supabase.storage
      .from('daily-report')
      .remove([path]);
    
    if (error) {
      console.error('DEBUG: Supabase delete error:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`DEBUG: Delete successful`);
    return { success: true, data };
    
  } catch (error) {
    console.error('DEBUG: Delete error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Move a file from temp to permanent location
 */
const moveFileInSupabase = async (oldPath, newPath) => {
  try {
    console.log(`DEBUG: Moving file - From: ${oldPath}, To: ${newPath}`);
    
    // Copy file to new location
    const { data: copyData, error: copyError } = await supabase.storage
      .from('daily-report')
      .copy(oldPath, newPath);
    
    if (copyError) {
      console.error('DEBUG: Copy error:', copyError);
      return { success: false, error: copyError.message };
    }
    
    // Delete old file
    const { data: deleteData, error: deleteError } = await supabase.storage
      .from('daily-report')
      .remove([oldPath]);
    
    if (deleteError) {
      console.error('DEBUG: Delete old file error:', deleteError);
      // Try to clean up the copied file
      await supabase.storage.from('daily-report').remove([newPath]);
      return { success: false, error: deleteError.message };
    }
    
    console.log(`DEBUG: Move successful`);
    return { success: true, data: copyData };
    
  } catch (error) {
    console.error('DEBUG: Move error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * List files in a directory
 */
const listFilesInSupabase = async (path, options = {}) => {
  try {
    console.log(`DEBUG: Listing files - Path: ${path}`);
    
    const { data, error } = await supabase.storage
      .from('daily-report')
      .list(path, options);
    
    if (error) {
      console.error('DEBUG: List error:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`DEBUG: Found ${data.length} files`);
    return { success: true, data };
    
  } catch (error) {
    console.error('DEBUG: List error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get public URL for a file
 */
const getPublicUrl = async (path) => {
  try {
    console.log(`DEBUG: Getting public URL for path: ${path}`);
    
    const { data } = supabase.storage
      .from('daily-report')
      .getPublicUrl(path);
    
    console.log(`DEBUG: Public URL generated: ${data.publicUrl}`);
    return data;
    
  } catch (error) {
    console.error('DEBUG: Get public URL error:', error);
    return { publicUrl: '' };
  }
};

/**
 * Test Supabase connection
 */
const testSupabaseConnection = async () => {
  try {
    console.log('DEBUG: Testing Supabase connection...');
    
    // Try to list the bucket (should fail if bucket doesn't exist)
    const { data, error } = await supabase.storage
      .from('daily-report')
      .list('', { limit: 1 });
    
    if (error && error.message.includes('bucket not found')) {
      return { success: false, error: 'Bucket "daily-report" does not exist' };
    }
    
    if (error && !error.message.includes('bucket not found')) {
      return { success: false, error: error.message };
    }
    
    console.log('DEBUG: Supabase connection successful');
    return { success: true, message: 'Supabase connection working' };
    
  } catch (error) {
    console.error('DEBUG: Connection test error:', error);
    return { success: false, error: error.message };
  }
};

// Export functions
module.exports = {
  supabase,
  uploadImageToSupabase,
  deleteFileFromSupabase,
  moveFileInSupabase,
  listFilesInSupabase,
  getPublicUrl,
  testSupabaseConnection
};
