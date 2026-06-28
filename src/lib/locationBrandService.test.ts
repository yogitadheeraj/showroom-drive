import { describe, expect, it } from 'vitest';
import { buildBrandPayload } from './locationBrandService';

describe('buildBrandPayload', () => {
  it('includes dealer, business unit, and branding metadata', () => {
    const payload = buildBrandPayload({
      name: 'Contoso',
      dealerId: 'dealer-1',
      orgId: 'dealer-1',
      businessUnitId: 'bu-1',
      salesOfficeId: 'so-1',
      plantId: 'pl-1',
      code: 'cns',
      description: 'Luxury brand',
      logo_url: 'https://cdn.example.com/logo.png',
      meta_title: 'Contoso Cars',
      meta_description: 'Contoso showroom',
    });

    expect(payload).toEqual({
      name: 'Contoso',
      dealer_id: 'dealer-1',
      orgId: 'dealer-1',
      businessUnitId: 'bu-1',
      salesOfficeId: 'so-1',
      plantId: 'pl-1',
      code: 'CNS',
      description: 'Luxury brand',
      logo_url: 'https://cdn.example.com/logo.png',
      meta_title: 'Contoso Cars',
      meta_description: 'Contoso showroom',
    });
  });
});
