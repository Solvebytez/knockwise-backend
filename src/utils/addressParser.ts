/**
 * Extract house number from address string
 * @param address - Full address string (e.g., "123 Main St, City, State")
 * @returns House number or null if not found
 */
export function extractHouseNumber(address: string): number | null {
  if (!address) return null;
  
  // Try multiple patterns to extract house number
  const patterns = [
    /^(\d+)/,                    // Number at the beginning: "123 Main St"
    /^(\d+)\s+/,                 // Number followed by space: "123 Main St"
    /^(\d+)[A-Za-z]/,            // Number followed by letter: "123A Main St"
    /^(\d+)-/,                   // Number with hyphen: "123-125 Main St"
    /^(\d+)\//,                  // Number with slash: "123/125 Main St"
    /^(\d+)\s*[A-Za-z]/,         // Number with optional space and letter: "123A Main St"
  ];
  
  for (const pattern of patterns) {
    const match = address.trim().match(pattern);
    if (match) {
      const houseNumber = parseInt(match[1] || '0', 10);
      if (houseNumber > 0) {
        return houseNumber;
      }
    }
  }
  
  // If no pattern matches, try to find any number in the first part of the address
  const firstPart = address.split(',')[0]; // Get the street part
  const numberMatch = firstPart?.match(/(\d+)/);
  if (numberMatch) {
    const houseNumber = parseInt(numberMatch[1] || '0', 10);
    if (houseNumber > 0) {
      return houseNumber;
    }
  }
  
  return null;
}

/**
 * Categorize house numbers into odd and even arrays
 * @param addresses - Array of address strings
 * @returns Object with odd and even house number arrays
 */
export function categorizeHouseNumbers(addresses: string[]): {
  odd: number[];
  even: number[];
} {
  const houseNumbers = addresses
    .map(extractHouseNumber)
    .filter((num): num is number => num !== null && !isNaN(num));
  
  return {
    odd: houseNumbers.filter(num => num % 2 === 1),
    even: houseNumbers.filter(num => num % 2 === 0)
  };
}

/**
 * Process building data and extract house numbers
 * @param addresses - Array of address strings
 * @param coordinates - Array of coordinate pairs [lng, lat]
 * @returns Processed building data with house numbers
 */
export function processBuildingData(
  addresses: string[], 
  coordinates: [number, number][]
): {
  totalBuildings: number;
  residentialHomes: number;
  addresses: string[];
  coordinates: [number, number][];
  houseNumbers: {
    odd: number[];
    even: number[];
  };
} {
  const houseNumbers = categorizeHouseNumbers(addresses);
  
  return {
    totalBuildings: addresses.length,
    residentialHomes: addresses.length, // Assuming all detected buildings are residential
    addresses,
    coordinates,
    houseNumbers
  };
}

/**
 * Get house number statistics
 * @param houseNumbers - Object with odd and even arrays
 * @returns Statistics about house numbers
 */
export function getHouseNumberStats(houseNumbers: {
  odd: number[];
  even: number[];
}): {
  total: number;
  oddCount: number;
  evenCount: number;
  oddRange?: { min: number; max: number };
  evenRange?: { min: number; max: number };
} {
  const oddCount = houseNumbers.odd.length;
  const evenCount = houseNumbers.even.length;
  const total = oddCount + evenCount;
  
  const oddRange = oddCount > 0 ? {
    min: Math.min(...houseNumbers.odd),
    max: Math.max(...houseNumbers.odd)
  } : undefined;
  
  const evenRange = evenCount > 0 ? {
    min: Math.min(...houseNumbers.even),
    max: Math.max(...houseNumbers.even)
  } : undefined;
  
  return {
    total,
    oddCount,
    evenCount,
    ...(oddRange && { oddRange }),
    ...(evenRange && { evenRange })
  };
}
