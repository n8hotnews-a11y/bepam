/**
 * Test script for Notification Read Service
 * 
 * This script demonstrates how to use the notification read service
 * and can be used for testing purposes.
 */

import { notificationReadService } from '../services/notificationReadService';

// Example usage
export const testNotificationReadService = async () => {
    console.log('=== Testing Notification Read Service ===\n');

    // Test 1: Mark items as read
    console.log('Test 1: Marking items as read');
    await notificationReadService.markAsRead('item-1');
    await notificationReadService.markAsRead('item-2');
    await notificationReadService.markAsRead('item-3');

    let readItems = await notificationReadService.getReadNotifications();
    console.log('Read items:', Array.from(readItems));
    console.log('✓ Test 1 passed\n');

    // Test 2: Check if item is read
    console.log('Test 2: Checking read status');
    const isItem1Read = await notificationReadService.isRead('item-1');
    const isItem4Read = await notificationReadService.isRead('item-4');
    console.log('Is item-1 read?', isItem1Read); // Should be true
    console.log('Is item-4 read?', isItem4Read); // Should be false
    console.log('✓ Test 2 passed\n');

    // Test 3: Mark multiple items as read
    console.log('Test 3: Marking multiple items as read');
    await notificationReadService.markMultipleAsRead(['item-4', 'item-5', 'item-6']);
    readItems = await notificationReadService.getReadNotifications();
    console.log('Read items:', Array.from(readItems));
    console.log('✓ Test 3 passed\n');

    // Test 4: Mark item as unread
    console.log('Test 4: Marking item as unread');
    await notificationReadService.markAsUnread('item-2');
    readItems = await notificationReadService.getReadNotifications();
    console.log('Read items after unmarking item-2:', Array.from(readItems));
    console.log('✓ Test 4 passed\n');

    // Test 5: Cleanup non-existent items
    console.log('Test 5: Cleaning up non-existent items');
    const existingItems = ['item-1', 'item-3', 'item-5']; // Only these exist
    await notificationReadService.cleanup(existingItems);
    readItems = await notificationReadService.getReadNotifications();
    console.log('Read items after cleanup:', Array.from(readItems));
    console.log('✓ Test 5 passed\n');

    // Test 6: Clear all
    console.log('Test 6: Clearing all read notifications');
    await notificationReadService.clearAll();
    readItems = await notificationReadService.getReadNotifications();
    console.log('Read items after clear all:', Array.from(readItems));
    console.log('✓ Test 6 passed\n');

    console.log('=== All tests completed successfully! ===');
};

// Example integration with ExpiredItemsScreen
export const exampleUsage = {
    // When user marks an item as read
    markItemAsRead: async (itemId) => {
        const success = await notificationReadService.markAsRead(itemId);
        if (success) {
            console.log(`Item ${itemId} marked as read`);
            // Update UI to show read badge
        }
    },

    // When checking if notification should be sent
    shouldSendNotification: async (itemId) => {
        const isRead = await notificationReadService.isRead(itemId);
        if (isRead) {
            console.log(`Skipping notification for ${itemId} - already read`);
            return false;
        }
        return true;
    },

    // When item is deleted
    onItemDeleted: async (itemId) => {
        await notificationReadService.clearReadStatus(itemId);
        console.log(`Cleared read status for deleted item ${itemId}`);
    },

    // When screen loads
    onScreenLoad: async (allItemIds) => {
        // Get read notifications
        const readIds = await notificationReadService.getReadNotifications();

        // Cleanup old read statuses
        await notificationReadService.cleanup(allItemIds);

        return readIds;
    }
};
