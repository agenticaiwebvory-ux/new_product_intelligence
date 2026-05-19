/**
 * Shared UI constants for the Product Intelligence dashboard.
 * Import these instead of hardcoding strings inline across components.
 */

/** Vendor name for The Dress Outlet catalog — matches DB value exactly */
export const TDO_VENDOR_NAME = 'The Dress Outlet'

/** Internal sentinel key used to switch to Merchandising Analytics mode */
export const MERCH_MODE_KEY = 'TDO_MERCH'

/** Default vendor shown in Catalog Health mode */
export const DEFAULT_CATALOG_VENDOR = TDO_VENDOR_NAME

/** Store keys supported by the platform */
export const STORE_KEYS = ['TDO', 'WDO', 'KOS', 'IM']

/** Human-readable labels for each store key */
export const STORE_LABELS = {
  TDO: 'TDO',
  WDO: 'WDO',
  KOS: 'KOS',
  IM: 'IM',
}
