import { randomUUID } from 'node:crypto';
import { createDealer } from './dealerService.js';
import { deleteDealer } from './dealerService.js';
import { createBrand } from './brandService.js';
import { deleteBrand } from './brandService.js';
import { createLocation } from './locationService.js';
import { deleteLocation } from './locationService.js';
import { deleteProfileByUserId, getProfileByUserId, upsertProfile } from './profileService.js';
import { deleteUserRole, getRoleByUserId, upsertUserRole } from './userRoleService.js';
import { sendMail } from './mailService.js';
import { Organization } from '../models/Organization.js';
import { RoleNew } from '../models/RoleNew.js';
import { UserRoleAssignmentNew } from '../models/UserRoleAssignmentNew.js';
import { ensureHierarchyRoleCatalogSeeded } from './hierarchyRoleCatalogService.js';

type LocationInput = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
};

function readArg<T>(args: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in args && args[key] !== undefined) {
      return args[key] as T;
    }
  }
  return undefined;
}

function requiredString(args: Record<string, unknown>, keys: string[], fieldName: string): string {
  const value = readArg<unknown>(args, ...keys);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

export async function runRpc(name: string, args: Record<string, unknown>) {
  if (name !== 'onboard_dealer' && name !== 'onboard_entity') {
    return { ok: true, rpc: name, args };
  }

  if (name === 'onboard_entity') {
    const userId = requiredString(args, ['_admin_user_id', 'admin_user_id', '_user_id', 'user_id'], 'admin_user_id');
    const organizationName = requiredString(args, ['_organization_name', 'organization_name', '_entity_name', 'entity_name'], 'organization_name');
    const fullName = requiredString(args, ['_full_name', 'full_name'], 'full_name');
    const email = requiredString(args, ['_email', 'email'], 'email');
    const contactPhone = readArg<string>(args, '_contact_phone', 'contact_phone');
    const country = String(readArg<string>(args, '_country', 'country') || 'AE').trim().toUpperCase() || 'AE';
    const type = String(readArg<string>(args, '_organization_type', 'organization_type') || 'ENTITY').trim().toUpperCase() || 'ENTITY';
    const code = requiredString(args, ['_organization_code', 'organization_code', '_code', 'code'], 'organization_code')
      .replace(/[^A-Za-z0-9_-]+/g, '')
      .toUpperCase();

    if (!['GROUP', 'ENTITY', 'COMPANY'].includes(type)) {
      throw new Error('organization_type must be GROUP, ENTITY, or COMPANY');
    }

    await ensureHierarchyRoleCatalogSeeded();

    const dealerAdminRole = await RoleNew.findOne({ code: 'DEALER_ADMIN', isActive: true }).lean();
    if (!dealerAdminRole?._id) {
      throw new Error('Hierarchy role catalog could not be initialized for onboarding.');
    }

    const existingProfile = await getProfileByUserId(userId);
    const existingRole = await getRoleByUserId(userId);
    const existingAssignments = await UserRoleAssignmentNew.find({ userId }).lean();
    const createdAssignmentIds: string[] = [];
    let createdOrgId = '';

    try {
      const org = await Organization.create({
        name: organizationName,
        code,
        type,
        country,
        isActive: true,
      });
      createdOrgId = String(org._id);

      await upsertProfile({
        user_id: userId,
        full_name: fullName,
        email,
        phone: contactPhone || null,
        location_id: null,
        brand_id: null,
        hierarchy_level: 'ORG',
        is_active: true,
      });

      await upsertUserRole(userId, 'dealer_admin');

      await UserRoleAssignmentNew.updateMany(
        { userId, isActive: true },
        { isPrimary: false },
      );

      const assignment = await UserRoleAssignmentNew.create({
        userId,
        roleId: dealerAdminRole._id,
        orgId: org._id,
        businessUnitId: null,
        brandId: null,
        salesOfficeId: null,
        plantId: null,
        locationId: null,
        isPrimary: true,
        isActive: true,
      });
      createdAssignmentIds.push(String(assignment._id));

      await sendMail({
        to: 'autoadvantplatform@gmail.com',
        subject: `New entity onboarding: ${organizationName}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
            <h2>New Entity Registered</h2>
            <p><strong>Organization:</strong> ${organizationName}</p>
            <p><strong>Code:</strong> ${code}</p>
            <p><strong>Type:</strong> ${type}</p>
            <p><strong>Country:</strong> ${country}</p>
            <p><strong>Admin Email:</strong> ${email}</p>
            <p><strong>Admin Name:</strong> ${fullName}</p>
            <p><strong>Contact Phone:</strong> ${contactPhone || 'N/A'}</p>
          </div>
        `,
        text: `New Entity Registered:\nOrganization: ${organizationName}\nCode: ${code}\nType: ${type}\nCountry: ${country}\nAdmin Email: ${email}\nAdmin Name: ${fullName}\nContact Phone: ${contactPhone || 'N/A'}`,
      });

      return {
        ok: true,
        organization_id: createdOrgId,
        organization_code: code,
      };
    } catch (error) {
      if (createdAssignmentIds.length > 0) {
        await UserRoleAssignmentNew.deleteMany({ _id: { $in: createdAssignmentIds } });
      }

      if (existingAssignments.length > 0) {
        await UserRoleAssignmentNew.deleteMany({ userId });
        await UserRoleAssignmentNew.insertMany(existingAssignments.map(({ _id, ...rest }: any) => rest));
      }

      if (existingRole) {
        await upsertUserRole(userId, existingRole.role);
      } else {
        await deleteUserRole(userId);
      }

      if (existingProfile) {
        await upsertProfile(existingProfile as unknown as Record<string, unknown>);
      } else {
        await deleteProfileByUserId(userId);
      }

      if (createdOrgId) {
        await Organization.findByIdAndDelete(createdOrgId);
      }

      throw error;
    }
  }

  const dealerId = randomUUID();
  const userId = requiredString(args, ['_admin_user_id', 'admin_user_id', '_user_id', 'user_id'], 'admin_user_id');
  const dealerName = requiredString(args, ['_dealer_name', 'dealer_name'], 'dealer_name');
  const contactEmail = requiredString(args, ['_contact_email', 'contact_email'], 'contact_email');
  const slug = requiredString(args, ['_slug', 'slug'], 'slug');
  const fullName = requiredString(args, ['_full_name', 'full_name'], 'full_name');
  const email = requiredString(args, ['_email', 'email'], 'email');
  const contactPhone = readArg<string>(args, '_contact_phone', 'contact_phone');

  const brandList = (
    readArg<unknown[]>(args, '_brands', 'brands') || []
  )
    .map((b) => String(b || '').trim())
    .filter(Boolean);

  if (!brandList.length) {
    throw new Error('At least one brand is required');
  }

  const rawLocations = readArg<LocationInput[]>(args, '_locations', 'locations') || [];
  if (!rawLocations.length) {
    throw new Error('At least one location is required');
  }

  const locationList = rawLocations.map((location, index) => {
    const locationName = typeof location.name === 'string' ? location.name.trim() : '';
    const city = typeof location.city === 'string' ? location.city.trim() : '';
    const address = typeof location.address === 'string' ? location.address.trim() : '';

    if (!locationName) {
      throw new Error(`locations[${index}].name is required`);
    }
    if (!city) {
      throw new Error(`locations[${index}].city is required`);
    }
    if (!address) {
      throw new Error(`locations[${index}].address is required`);
    }

    return {
      name: locationName,
      city,
      address,
      state: typeof location.state === 'string' && location.state.trim() ? location.state.trim() : null,
      phone: typeof location.phone === 'string' && location.phone.trim() ? location.phone.trim() : null,
      email: typeof location.email === 'string' && location.email.trim() ? location.email.trim() : null,
      brands: Array.isArray((location as any).brands)
        ? (location as any).brands.map((b: any) => String(b || '').trim()).filter(Boolean)
        : typeof (location as any).brand === 'string' && (location as any).brand.trim()
          ? [ (location as any).brand.trim() ]
          : [],
    };
  });

  const existingProfile = await getProfileByUserId(userId);
  const existingRole = await getRoleByUserId(userId);
  const createdBrandIds: string[] = [];
  const createdLocationIds: string[] = [];
  let dealerCreated = false;

  try {
    await createDealer({
      id: dealerId,
      name: dealerName,
      slug,
      contact_email: contactEmail,
      contact_phone: contactPhone || null,
      admin_user_id: userId,
      is_active: true,
    });
    dealerCreated = true;

    for (const brandName of brandList) {
      const createdBrand = await createBrand({
        dealer_id: dealerId,
        name: brandName,
        description: null,
        logo_url: null,
        meta_title: null,
        meta_description: null,
        is_active: true,
      });
      createdBrandIds.push(String(createdBrand.id));
    }

    for (const location of locationList) {
      const created = await createLocation({
        dealer_id: dealerId,
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        phone: location.phone,
        email: location.email,
        brands: (location as any).brands && Array.isArray((location as any).brands)
          ? (location as any).brands.map((b: string) => ({ name: String(b), is_active: true }))
          : [],
        is_active: true,
      });
      createdLocationIds.push(String(created.id));
    }

    const primaryLocationId = createdLocationIds[0] || null;
    await upsertProfile({
      user_id: userId,
      full_name: fullName,
      email,
      location_id: primaryLocationId,
      is_active: true,
    });

    await upsertUserRole(userId, 'dealer_admin');

    await sendMail({
      to: 'autoadvantplatform@gmail.com',
      subject: `New dealer onboarding: ${dealerName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
          <h2>New Dealer / Entity Registered</h2>
          <p><strong>Dealer Name:</strong> ${dealerName}</p>
          <p><strong>Admin Email:</strong> ${email}</p>
          <p><strong>Contact Email:</strong> ${contactEmail}</p>
          <p><strong>Contact Phone:</strong> ${contactPhone || 'N/A'}</p>
          <p><strong>Brands:</strong> ${brandList.join(', ')}</p>
          <p><strong>Locations:</strong> ${locationList.length}</p>
          <p><strong>Dealer Slug:</strong> ${slug}</p>
        </div>
      `,
      text: `New Dealer / Entity Registered:\nDealer Name: ${dealerName}\nAdmin Email: ${email}\nContact Email: ${contactEmail}\nContact Phone: ${contactPhone || 'N/A'}\nBrands: ${brandList.join(', ')}\nLocations: ${locationList.length}\nDealer Slug: ${slug}`,
    });
  } catch (error) {
    // Compensating rollback to avoid partial onboarding data.
    if (existingRole) {
      await upsertUserRole(userId, existingRole.role);
    } else {
      await deleteUserRole(userId);
    }

    if (existingProfile) {
      await upsertProfile(existingProfile as unknown as Record<string, unknown>);
    } else {
      await deleteProfileByUserId(userId);
    }

    for (const locationId of createdLocationIds.reverse()) {
      await deleteLocation(locationId);
    }

    for (const brandId of createdBrandIds.reverse()) {
      await deleteBrand(brandId);
    }

    if (dealerCreated) {
      await deleteDealer(dealerId);
    }

    throw error;
  }

  return {
    ok: true,
    dealer_id: dealerId,
    location_id: createdLocationIds[0] || null,
    location_ids: createdLocationIds,
    brands_created: brandList.length,
  };
}
