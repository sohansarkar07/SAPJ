import { apiClient } from './apiClient.js';

/**
 * Fetch emails from the backend API.
 * The backend handles calling the Gmail API using stored OAuth tokens.
 * 
 * @returns {Promise<Array>} List of email objects
 */
export async function fetchEmails() {
    try {
        const response = await apiClient.get('/emails');
        return response.data;
    } catch (error) {
        console.error('Error fetching emails from backend:', error);
        throw error;
    }
}
