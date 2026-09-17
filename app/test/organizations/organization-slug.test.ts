import { describe, expect, it } from "vitest";

import { createOrganizationSlug } from "../../services/organizations/organization-slug";

describe("createOrganizationSlug", () => {
  it("converts an organization name to a lowercase slug", () => {
    expect(createOrganizationSlug("Acme Printing")).toBe("acme-printing");
  });

  it("trims surrounding whitespace", () => {
    expect(createOrganizationSlug("  Acme Printing  ")).toBe("acme-printing");
  });

  it("replaces punctuation and spaces with hyphens", () => {
    expect(createOrganizationSlug("Nelson's Print Shop")).toBe("nelson-s-print-shop");
  });

  it("removes diacritical marks", () => {
    expect(createOrganizationSlug("José's Signs")).toBe("jose-s-signs");
  });

  it("collapses consecutive separators", () => {
    expect(createOrganizationSlug("Acme --- Print & Design")).toBe("acme-print-design");
  });

  it("removes leading and trailing separators", () => {
    expect(createOrganizationSlug("--- Acme Printing ---")).toBe("acme-printing");
  });

  it("returns an empty slug when the name contains no supported characters", () => {
    expect(createOrganizationSlug("!!!")).toBe("");
  });
});
