import { SalesOffice } from '../models/SalesOffice.js';
import { Plant } from '../models/Plant.js';
import { LocationNew } from '../models/LocationNew.js';

/**
 * Generates human-readable codes for sales offices, plants, and locations
 * Format: PREFIX-CITY-BUSINESSUNIT-SEQUENCE
 * Example: SO-DXB-BYD-001
 */

const getCityCode = (city: string | null | undefined): string => {
  const cityMap: Record<string, string> = {
    'Dubai': 'DXB',
    'Abu Dhabi': 'AUH',
    'Sharjah': 'SHJ',
    'Ajman': 'AJM',
    'Ras Al Khaimah': 'RAK',
    'Umm Al Quwain': 'UAQ',
    'Fujairah': 'FUJ',
    'Mumbai': 'MUM',
    'Bangalore': 'BLR',
    'Delhi': 'DLH',
    'Hyderabad': 'HYD',
  };
  const normalized = String(city || '').trim();
  if (!normalized) return 'GEN';
  return cityMap[normalized] || normalized.substring(0, 3).toUpperCase();
};

const getBusinessUnitCode = (buName: string | null | undefined): string => {
  const normalized = String(buName || '').trim();
  if (!normalized) return 'GEN';
  return normalized.substring(0, 3).toUpperCase();
};

export async function generateSalesOfficeCode(city: string | null | undefined, businessUnitCode: string | null | undefined): Promise<string> {
  const cityCode = getCityCode(city);
  const buCode = getBusinessUnitCode(businessUnitCode);
  
  // Get the next sequence number
  const lastOffice = await SalesOffice.findOne({
    salesOfficeCode: new RegExp(`^SO-${cityCode}-${buCode}-`)
  })
    .sort({ createdAt: -1 })
    .lean();
  
  const sequence = lastOffice ? parseInt(lastOffice.salesOfficeCode.split('-').pop() || '0', 10) + 1 : 1;
  return `SO-${cityCode}-${buCode}-${String(sequence).padStart(3, '0')}`;
}

export async function generatePlantCode(city: string | null | undefined, businessUnitCode: string | null | undefined): Promise<string> {
  const cityCode = getCityCode(city);
  const buCode = getBusinessUnitCode(businessUnitCode);
  
  // Get the next sequence number
  const lastPlant = await Plant.findOne({
    plantCode: new RegExp(`^PL-${cityCode}-${buCode}-`)
  })
    .sort({ createdAt: -1 })
    .lean();
  
  const sequence = lastPlant ? parseInt(lastPlant.plantCode.split('-').pop() || '0', 10) + 1 : 1;
  return `PL-${cityCode}-${buCode}-${String(sequence).padStart(3, '0')}`;
}

export async function generateLocationCode(city: string | null | undefined, businessUnitCode: string | null | undefined): Promise<string> {
  const cityCode = getCityCode(city);
  const buCode = getBusinessUnitCode(businessUnitCode);
  
  // Get the next sequence number
  const lastLocation = await LocationNew.findOne({
    locationCode: new RegExp(`^LOC-${cityCode}-${buCode}-`)
  })
    .sort({ createdAt: -1 })
    .lean();
  
  const sequence = lastLocation ? parseInt(lastLocation.locationCode.split('-').pop() || '0', 10) + 1 : 1;
  return `LOC-${cityCode}-${buCode}-${String(sequence).padStart(3, '0')}`;
}

export async function generateVehicleCode(orgCode: string, buCode: string, year: number): Promise<string> {
  const prefix = `${orgCode}-${buCode}-${year}`;
  
  // Count existing vehicles with this prefix to generate sequence
  const count = await (require('../models/VehicleNew.js').VehicleNew as any)
    .countDocuments({ vehicleCode: new RegExp(`^${prefix}-`) })
    .exec();
  
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}
