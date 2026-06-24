import { Organization } from '../models/Organization.js';
import { BusinessUnit } from '../models/BrandNew.js';
import { BrandNew } from '../models/BrandNewModel.js';
import { BusinessUnitBrand } from '../models/BusinessUnitBrand.js';
import { SalesOffice } from '../models/SalesOffice.js';
import { Plant } from '../models/Plant.js';
import { LocationNew } from '../models/LocationNew.js';
import { VehicleNew } from '../models/VehicleNew.js';
import { LeadNew } from '../models/LeadNew.js';
import { TestDriveNew } from '../models/TestDriveNew.js';
import { RoleNew } from '../models/RoleNew.js';
import { PermissionNew } from '../models/PermissionNew.js';
import { RolePermissionNew } from '../models/RolePermissionNew.js';
import { UserRoleAssignmentNew } from '../models/UserRoleAssignmentNew.js';
import { 
  generateSalesOfficeCode, 
  generatePlantCode, 
  generateLocationCode,
  generateVehicleCode 
} from '../utils/codeGeneratorHelper.js';

/**
 * Organization Service
 */
export const OrganizationService = {
  async create(data: any) {
    const org = new Organization(data);
    return await org.save();
  },

  async findAll(filters: any = {}) {
    return await Organization.find({ ...filters, isActive: true }).lean();
  },

  async findById(id: string) {
    return await Organization.findById(id).lean();
  },

  async update(id: string, data: any) {
    return await Organization.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true }).lean();
  },

  async delete(id: string) {
    return await Organization.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
  },
};

/**
 * Business Unit Service
 */
export const BusinessUnitService = {
  async create(data: any) {
    const bu = new BusinessUnit(data);
    return await bu.save();
  },

  async findAll(filters: any = {}) {
    return await BusinessUnit.find({ ...filters, isActive: true })
      .populate('orgId')
      .lean();
  },

  async findById(id: string) {
    return await BusinessUnit.findById(id).populate('orgId').lean();
  },

  async update(id: string, data: any) {
    return await BusinessUnit.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true })
      .populate('orgId')
      .lean();
  },

  async delete(id: string) {
    return await BusinessUnit.findByIdAndUpdate(id, { isActive: false }, { new: true })
      .populate('orgId')
      .lean();
  },
};

/**
 * Brand Service
 */
export const BrandService = {
  async create(data: any) {
    const brand = new BrandNew(data);
    return await brand.save();
  },

  async findAll(filters: any = {}) {
    return await BrandNew.find({ ...filters, isActive: true }).lean();
  },

  async findById(id: string) {
    return await BrandNew.findById(id).lean();
  },

  async update(id: string, data: any) {
    return await BrandNew.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true }).lean();
  },
};

/**
 * Business Unit Brand Mapping Service
 */
export const BusinessUnitBrandService = {
  async create(data: any) {
    // Check for duplicate
    const existing = await BusinessUnitBrand.findOne({
      businessUnitId: data.businessUnitId,
      brandId: data.brandId,
    });
    if (existing) {
      throw new Error('Mapping already exists');
    }
    const mapping = new BusinessUnitBrand(data);
    return await mapping.save();
  },

  async findByBusinessUnit(businessUnitId: string) {
    return await BusinessUnitBrand.find({ businessUnitId, isActive: true })
      .populate('businessUnitId')
      .populate('brandId')
      .lean();
  },

  async validateBrandAccess(businessUnitId: string, brandId: string, condition: string) {
    const mapping = await BusinessUnitBrand.findOne({
      businessUnitId,
      brandId,
      isActive: true,
    }).lean();

    if (!mapping) {
      throw new Error(`Brand not allowed for this business unit`);
    }

    if (!mapping.allowedConditions.includes(condition)) {
      throw new Error(`Condition "${condition}" not allowed for this brand`);
    }

    return mapping;
  },

  async delete(id: string) {
    return await BusinessUnitBrand.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
  },
};

/**
 * Sales Office Service
 */
export const SalesOfficeService = {
  async create(data: any) {
    const code = await generateSalesOfficeCode(data.city, data.businessUnitId);
    const salesOffice = new SalesOffice({ ...data, salesOfficeCode: code });
    return await salesOffice.save();
  },

  async findAll(filters: any = {}) {
    return await SalesOffice.find({ ...filters, isActive: true })
      .populate('orgId')
      .populate('businessUnitId')
      .lean();
  },

  async findById(id: string) {
    return await SalesOffice.findById(id)
      .populate('orgId')
      .populate('businessUnitId')
      .lean();
  },

  async update(id: string, data: any) {
    return await SalesOffice.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true })
      .populate('orgId')
      .populate('businessUnitId')
      .lean();
  },
};

/**
 * Plant Service
 */
export const PlantService = {
  async create(data: any) {
    const code = await generatePlantCode(data.city, data.businessUnitId);
    const plant = new Plant({ ...data, plantCode: code });
    return await plant.save();
  },

  async findAll(filters: any = {}) {
    return await Plant.find({ ...filters, isActive: true })
      .populate('orgId')
      .populate('businessUnitId')
      .populate('salesOfficeId')
      .lean();
  },

  async findById(id: string) {
    return await Plant.findById(id)
      .populate('orgId')
      .populate('businessUnitId')
      .populate('salesOfficeId')
      .lean();
  },

  async update(id: string, data: any) {
    return await Plant.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true })
      .populate('orgId')
      .populate('businessUnitId')
      .populate('salesOfficeId')
      .lean();
  },
};

/**
 * Location Service
 */
export const LocationService = {
  async create(data: any) {
    const code = await generateLocationCode(data.city, data.businessUnitId);
    const location = new LocationNew({ ...data, locationCode: code });
    return await location.save();
  },

  async findAll(filters: any = {}) {
    return await LocationNew.find({ ...filters, isActive: true })
      .populate('orgId')
      .populate('businessUnitId')
      .populate('salesOfficeId')
      .populate('plantId')
      .lean();
  },

  async findById(id: string) {
    return await LocationNew.findById(id)
      .populate('orgId')
      .populate('businessUnitId')
      .populate('salesOfficeId')
      .populate('plantId')
      .lean();
  },

  async update(id: string, data: any) {
    return await LocationNew.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true })
      .populate('orgId')
      .populate('businessUnitId')
      .populate('salesOfficeId')
      .populate('plantId')
      .lean();
  },
};

/**
 * Vehicle Service
 */
export const VehicleService = {
  async create(data: any) {
    // Validate brand is allowed for business unit and condition
    await BusinessUnitBrandService.validateBrandAccess(data.businessUnitId, data.brandId, data.condition);

    const code = await generateVehicleCode(data.orgId, data.businessUnitId, data.year);
    const vehicle = new VehicleNew({ ...data, vehicleCode: code });
    return await vehicle.save();
  },

  async findAll(filters: any = {}) {
    return await VehicleNew.find({ ...filters, isActive: true })
      .populate('orgId')
      .populate('businessUnitId')
      .populate('brandId')
      .populate('locationId')
      .lean();
  },

  async findById(id: string) {
    return await VehicleNew.findById(id)
      .populate('orgId')
      .populate('businessUnitId')
      .populate('brandId')
      .populate('locationId')
      .lean();
  },

  async update(id: string, data: any) {
    return await VehicleNew.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true })
      .populate('orgId')
      .populate('businessUnitId')
      .populate('brandId')
      .populate('locationId')
      .lean();
  },

  async updateStatus(id: string, status: string) {
    return await VehicleNew.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true }).lean();
  },
};

/**
 * Lead Service
 */
export const LeadService = {
  async create(data: any) {
    const lead = new LeadNew(data);
    return await lead.save();
  },

  async findAll(filters: any = {}) {
    return await LeadNew.find({ ...filters })
      .populate('orgId')
      .populate('businessUnitId')
      .populate('brandId')
      .populate('vehicleId')
      .lean();
  },

  async findById(id: string) {
    return await LeadNew.findById(id)
      .populate('orgId')
      .populate('businessUnitId')
      .populate('brandId')
      .populate('vehicleId')
      .lean();
  },

  async update(id: string, data: any) {
    return await LeadNew.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true })
      .populate('orgId')
      .populate('businessUnitId')
      .populate('brandId')
      .populate('vehicleId')
      .lean();
  },

  async assign(id: string, salesPersonId: string) {
    return await LeadNew.findByIdAndUpdate(
      id,
      { status: 'ASSIGNED', assignedTo: salesPersonId, updatedAt: new Date() },
      { new: true }
    ).lean();
  },
};

/**
 * Test Drive Service
 */
export const TestDriveService = {
  async create(data: any) {
    const testDrive = new TestDriveNew(data);
    return await testDrive.save();
  },

  async findAll(filters: any = {}) {
    return await TestDriveNew.find({ ...filters })
      .populate('orgId')
      .populate('businessUnitId')
      .populate('brandId')
      .populate('vehicleId')
      .populate('leadId')
      .lean();
  },

  async findById(id: string) {
    return await TestDriveNew.findById(id)
      .populate('orgId')
      .populate('businessUnitId')
      .populate('brandId')
      .populate('vehicleId')
      .populate('leadId')
      .lean();
  },

  async update(id: string, data: any) {
    return await TestDriveNew.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true })
      .populate('orgId')
      .populate('businessUnitId')
      .populate('brandId')
      .populate('vehicleId')
      .lean();
  },

  async updateStatus(id: string, status: string) {
    return await TestDriveNew.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true }).lean();
  },

  async assign(id: string, salesPersonId: string, groId?: string, securityId?: string) {
    const data: any = { assignedSalesPersonId: salesPersonId, status: 'CONFIRMED' };
    if (groId) data.groId = groId;
    if (securityId) data.securityId = securityId;
    return await TestDriveNew.findByIdAndUpdate(id, data, { new: true }).lean();
  },
};

/**
 * Role Service
 */
export const RoleService = {
  async create(data: any) {
    const role = new RoleNew(data);
    return await role.save();
  },

  async findAll(filters: any = {}) {
    return await RoleNew.find({ ...filters, isActive: true }).lean();
  },

  async findById(id: string) {
    return await RoleNew.findById(id).lean();
  },

  async findByCode(code: string) {
    return await RoleNew.findOne({ code, isActive: true }).lean();
  },
};

/**
 * Permission Service
 */
export const PermissionService = {
  async create(data: any) {
    const permission = new PermissionNew(data);
    return await permission.save();
  },

  async findAll(filters: any = {}) {
    return await PermissionNew.find(filters).lean();
  },

  async findById(id: string) {
    return await PermissionNew.findById(id).lean();
  },
};

/**
 * Role Permission Service
 */
export const RolePermissionService = {
  async assignPermissions(roleId: string, permissionIds: string[]) {
    // Remove existing permissions
    await RolePermissionNew.deleteMany({ roleId });

    // Add new permissions
    const assignments = permissionIds.map((permissionId) => ({
      roleId,
      permissionId,
    }));

    return await RolePermissionNew.insertMany(assignments);
  },

  async getPermissionsByRole(roleId: string) {
    return await RolePermissionNew.find({ roleId })
      .populate('permissionId')
      .lean();
  },
};

/**
 * User Role Assignment Service
 */
export const UserRoleAssignmentService = {
  async assign(data: any) {
    // Check for primary assignment
    if (data.isPrimary) {
      await UserRoleAssignmentNew.updateMany(
        { userId: data.userId },
        { isPrimary: false }
      );
    }

    const assignment = new UserRoleAssignmentNew(data);
    return await assignment.save();
  },

  async findByUser(userId: string) {
    return await UserRoleAssignmentNew.find({ userId, isActive: true })
      .populate('roleId')
      .populate('orgId')
      .populate('businessUnitId')
      .populate('brandId')
      .populate('salesOfficeId')
      .populate('plantId')
      .populate('locationId')
      .lean();
  },

  async findAll(filters: any = {}) {
    return await UserRoleAssignmentNew.find({ ...filters, isActive: true })
      .populate('roleId')
      .populate('orgId')
      .populate('businessUnitId')
      .populate('brandId')
      .populate('salesOfficeId')
      .populate('plantId')
      .populate('locationId')
      .lean();
  },

  async findPrimaryByUser(userId: string) {
    return await UserRoleAssignmentNew.findOne({ userId, isPrimary: true, isActive: true })
      .populate('roleId')
      .populate('orgId')
      .lean();
  },

  async update(id: string, data: any) {
    return await UserRoleAssignmentNew.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true })
      .populate('roleId')
      .lean();
  },

  async revoke(id: string) {
    return await UserRoleAssignmentNew.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
  },
};
