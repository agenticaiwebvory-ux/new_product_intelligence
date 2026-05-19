GET_PRODUCTS_BY_VENDOR = """
query getProductsByVendor($query: String!, $cursor: String) {
  products(first: 50, query: $query, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id title handle descriptionHtml vendor tags
        images(first: 5) { edges { node { url } } }
        variants(first: 100) {
          edges {
            node {
              id sku title inventoryQuantity price
              selectedOptions { name value }
            }
          }
        }
      }
    }
  }
}
"""

GET_PRODUCT_VARIANTS = """
query getProductVariants($id: ID!) {
  product(id: $id) {
    variants(first: 100) {
      edges { node { id } }
    }
  }
}
"""
