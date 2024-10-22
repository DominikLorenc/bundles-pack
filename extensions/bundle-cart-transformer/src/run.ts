import { RunInput, FunctionResult, CartOperation } from "../generated/api";

const NO_CHANGES: FunctionResult = {
  operations: [],
};

// Function to calculate the discount and apply price adjustments
export const run = (input: RunInput): FunctionResult => {
  // Function to apply discount based on the discount percentage
  const applyDiscount = (
    lineItem: (typeof input.cart.lines)[0],
    discountPercentage: string | null,
    basePrice: number,
    cartTransformOperations: CartOperation[]
  ) => {
    const discountAmount = (basePrice * Number(discountPercentage)) / 100; // Calculate the discount amount
    const newPrice = basePrice - discountAmount; // Calculate the new price after discount

    cartTransformOperations.push({
      update: {
        cartLineId: lineItem.id,
        price: {
          adjustment: {
            fixedPricePerUnit: {
              amount: newPrice.toString(), // Apply the discounted price
            },
          },
        },
      },
    });
  };

  // Function to apply the base price if no discount is applicable
  const applyBasePrice = (
    lineItem: (typeof input.cart.lines)[0],
    basePrice: number,
    cartTransformOperations: CartOperation[]
  ) => {
    cartTransformOperations.push({
      update: {
        cartLineId: lineItem.id,
        price: {
          adjustment: {
            fixedPricePerUnit: {
              amount: basePrice.toString(), // Set the base price without discount
            },
          },
        },
      },
    });
  };

  // Reduce the cart lines to gather products with pack discounts
  const packProductsWithQuantity = input.cart.lines.reduce((acc, lineItem) => {
    if ("product" in lineItem.merchandise) {
      const threePackDiscount =
        lineItem.merchandise.product?.threePackPrice?.value ?? null; // Contains the discount percentage for 3-pack
      const twoPackDiscount =
        lineItem.merchandise.product?.twoPackPrice?.value ?? null; // Contains the discount percentage for 2-pack
      const isBundle = lineItem.bundleItem?.value === "Yes"; // Check if the product is a bundle

      // If there are any discounts for the product, accumulate the quantity
      if (isBundle && (twoPackDiscount || threePackDiscount)) {
        const prevQuantity =
          acc[lineItem.merchandise.product.id]?.quantity ?? 0;
        acc[lineItem.merchandise.product.id] = {
          quantity: prevQuantity + lineItem.quantity,
          twoPackDiscount,
          threePackDiscount,
          discountApplied: 0, // Track how much discount has been applied
        };
      }
    }
    return acc;
  }, {} as Record<string, { quantity: number; twoPackDiscount: string | null; threePackDiscount: string | null; discountApplied: number }>);

  const cartTransformOperations: CartOperation[] = [];

  // Iterate over the cart lines to apply discounts
  input.cart.lines.forEach((lineItem) => {
    if ("product" in lineItem.merchandise) {
      const packProduct =
        packProductsWithQuantity[lineItem.merchandise.product.id];

      if (packProduct) {
        const { quantity, twoPackDiscount, threePackDiscount } = packProduct;
        const basePrice = Number(lineItem.cost.amountPerQuantity.amount); // Base price of the product

        // Apply discount for 3-Pack if quantity equals 3
        if (quantity === 3 && threePackDiscount) {
          applyDiscount(
            lineItem,
            threePackDiscount,
            basePrice,
            cartTransformOperations
          );
          return;
        }

        // Apply discount for 2-Pack if quantity equals 2
        if (quantity === 2 && twoPackDiscount) {
          applyDiscount(
            lineItem,
            twoPackDiscount,
            basePrice,
            cartTransformOperations
          );
          return;
        }

        // If quantity is less than 2 or greater than 3, set to base price
        applyBasePrice(lineItem, basePrice, cartTransformOperations);
      }
    }
  });

  return cartTransformOperations.length > 0
    ? { operations: cartTransformOperations }
    : NO_CHANGES;
};
