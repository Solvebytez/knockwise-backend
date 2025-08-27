import express from 'express'
import axios from 'axios'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

// Proxy endpoint for Google Address Validation API
router.post('/validate-address', requireAuth, async (req, res) => {
  try {
    console.log('=== Address Validation Backend Request ===')
    console.log('Request body:', JSON.stringify(req.body, null, 2))
    console.log('API Key:', process.env.GOOGLE_MAPS_API_KEY ? 'Present' : 'Missing')
    
    const { address } = req.body
    
    if (!address || !address.addressLines) {
      console.log('Validation failed: Missing address data')
      return res.status(400).json({
        success: false,
        message: 'Address data is required'
      })
    }

    const url = `https://addressvalidation.googleapis.com/v1:validateAddress?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    console.log('Google API URL:', url)
    
    const requestBody = {
      address: {
        addressLines: address.addressLines,
        regionCode: address.regionCode || 'CA'
      }
    }

    console.log('Google API Request Body:', JSON.stringify(requestBody, null, 2))

    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    console.log('Google API Response Status:', response.status)
    console.log('Google API Response Data:', JSON.stringify(response.data, null, 2))

    res.json({
      success: true,
      data: response.data
    })

  } catch (error: any) {
    console.log('=== Address Validation Backend Error ===')
    console.error('Error type:', typeof error)
    console.error('Error message:', error.message)
    console.error('Error response status:', error.response?.status)
    console.error('Error response data:', JSON.stringify(error.response?.data, null, 2))
    console.error('Error stack:', error.stack)
    
    res.status(500).json({
      success: false,
      message: 'Address validation failed',
      error: error.response?.data || error.message
    })
  }
})

export default router
