# Test Files Directory

This directory contains various test scripts and utilities for the Knockwise backend.

## Test Scripts

### Zone Assignment Tests
- **check-zones-direct.js** - Direct zone checking utility
- **check-third-zone-assignment.js** - Test for third zone assignment functionality
- **assign-zones-to-team.js** - Script to assign zones to teams
- **check-teams-and-assign-zones.js** - Test team and zone assignment logic
- **fix-zone-assignments-simple.js** - Simple zone assignment fix utility
- **fix-zone-assignments.js** - Comprehensive zone assignment fix utility
- **check-assignments.js** - General assignment checking utility

### Status and Logic Tests
- **test-completed-status.js** - Test completed status functionality
- **test-status-logic.js** - Test status logic implementation
- **test_assignment.json** - Test assignment data in JSON format
- **test-team-zone-sync.js** - Test team zone synchronization when members are added/removed
- **test-delete-modal-behavior.js** - Test delete modal behavior and API responses

### Data Cleanup Scripts
- **simple-delete-residents.js** - Simple resident deletion utility
- **cleanup-orphaned-data.js** - Clean up orphaned data in database
- **delete-all-residential-data.js** - Delete all residential data utility

### Documentation
- **DELETE_ZONE_API.md** - Documentation for the delete zone API
- **cookies.txt** - Test authentication cookies file

## Usage

Most of these scripts can be run directly with Node.js:

```bash
node tests/script-name.js
```

## Notes

- These are development and testing utilities
- Some scripts may modify database data
- Always backup your database before running cleanup scripts
- The cookies.txt file contains test authentication tokens
