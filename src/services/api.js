const API_BASE_URL = 'http://localhost:5000/api';

// Generic fetch wrapper with error handling
const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

// Landing page statistics
export const getStats = async () => {
  return apiCall('/stats');
};

// Job listings
export const getRecentJobs = async (limit = 5) => {
  return apiCall(`/jobs/recent?limit=${limit}`);
};

export const getAllJobs = async () => {
  return apiCall('/jobs');
};

export const getJobById = async (id) => {
  return apiCall(`/jobs/${id}`);
};

export const createJobListing = async (jobData) => {
  return apiCall('/jobs', {
    method: 'POST',
    body: JSON.stringify(jobData),
  });
};

// User authentication
export const registerUser = async (userData) => {
  return apiCall('/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

export const loginUser = async (credentials) => {
  return apiCall('/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
};

// Users (for admin purposes)
export const getAllUsers = async () => {
  return apiCall('/users');
};

// Jobseeker specific endpoints
export const getJobseekerProfile = async (id) => {
  return apiCall(`/jobseeker/${id}`);
};

export const updateJobseekerProfile = async (id, profileData) => {
  return apiCall(`/jobseeker/${id}`, {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
};

export const getAllJobseekers = async () => {
  return apiCall('/jobseekers');
};

// Job liking functionality
export const likeJob = async (jobId, jobseekerId) => {
  return apiCall(`/jobs/${jobId}/like`, {
    method: 'POST',
    body: JSON.stringify({ jobseeker_id: jobseekerId }),
  });
};

export const unlikeJob = async (jobId, jobseekerId) => {
  return apiCall(`/jobs/${jobId}/like`, {
    method: 'DELETE',
    body: JSON.stringify({ jobseeker_id: jobseekerId }),
  });
};

export const getLikedJobs = async (jobseekerId) => {
  return apiCall(`/jobseeker/${jobseekerId}/liked-jobs`);
};

export const checkJobLiked = async (jobId, jobseekerId) => {
  return apiCall(`/jobs/${jobId}/liked/${jobseekerId}`);
};

