import { RunInput, FunctionResult, CartOperation } from "../generated/api";

const NO_CHANGES: FunctionResult = {
  operations: [],
};

export const run = (input: RunInput): FunctionResult => {
  // Group cart lines by bundle ID with relevant product details
  const groupedItems: Record<
    string,
    {
      id: string;
      quantity: number;
      twoPackDiscount?: string | null;
      threePackDiscount?: string | null;
      variantId?: string;
      productId?: string;
    }[]
  > = {};

  input.cart.lines.forEach((line) => {
    const bundleID = line.bundleID?.value;
    if (bundleID && "product" in line.merchandise) {
      const merchandise = line.merchandise;

      // Initialize array if it doesn't exist
      if (!groupedItems[bundleID]) {
        groupedItems[bundleID] = [];
      }

      groupedItems[bundleID].push({
        id: line.id,
        quantity: line.quantity,
        twoPackDiscount: merchandise.product.twoPackPrice?.value ?? null,
        threePackDiscount: merchandise.product.threePackPrice?.value ?? null,
        variantId: merchandise.id,
        productId: merchandise.product.id,
      });
    }
  });

  const createBundleOperation = (
    group: (typeof groupedItems)[string],
    bundleSize: number,
    discount: string | null,
    title: string,
    bundleType: string
  ): CartOperation | undefined => {
    if (group.length > 0 && discount) {
      const productId = group[0].productId?.split("/").pop() ?? "";
      const variantIds = group.flatMap(({ variantId, quantity }) =>
        new Array(quantity).fill(variantId?.split("/").pop() ?? "")
      );

      return {
        merge: {
          cartLines: group.map(({ id, quantity }) => ({
            cartLineId: id,
            quantity,
          })),
          parentVariantId: "gid://shopify/ProductVariant/45912885493998",
          price: {
            percentageDecrease: {
              value: discount,
            },
          },
          attributes: [
            {
              key: "_bundleMessage",
              value: `Bundle and save! ${discount}% OFF`,
            },
            { key: "_variantId", value: JSON.stringify(variantIds) },
            { key: "_productId", value: productId },
            { key: "_discount", value: discount },
          ],
        },
      };
    }
    return;
  };

  const operations: CartOperation[] = Object.values(groupedItems)
    .map((group) => {
      const groupTotalQuantity = group.reduce(
        (acc, { quantity }) => acc + quantity,
        0
      );

      if (groupTotalQuantity === 2) {
        return createBundleOperation(
          group,
          2,
          group[0].twoPackDiscount ?? "0",
          "2-Pack Bundle",
          "2-pack"
        );
      }

      if (groupTotalQuantity === 3) {
        return createBundleOperation(
          group,
          3,
          group[0].threePackDiscount ?? "0",
          "3-Pack Bundle",
          "3-pack"
        );
      }

      return;
    })
    .filter(Boolean) as CartOperation[];

  return operations.length ? { operations } : NO_CHANGES;
};
