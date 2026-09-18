
import { useState, useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { IAPProduct } from 'react-native-iap'; // Import IAPProduct for type safety

const { RNIapModule } = NativeModules;

// Type for the IAP products, including platform-specific details
type IapProduct = IAPProduct & {
  // Add any specific fields you expect from your backend or native module
  // For example, if your backend sends a custom 'title' or 'description'
  // iOS specific fields from react-native-iap might include 'localizedTitle', 'localizedDescription'
  // Android specific fields might include 'title', 'description'
  // It's good practice to align this with what react-native-iap returns
  localizedTitle?: string;
  localizedDescription?: string;
  originalPrice?: string; // e.g., "4.99"
  originalCurrency?: string; // e.g., "USD"
};

type IapServiceHook = {
  products: IapProduct[];
  fetchProducts: () => Promise<void>;
  purchaseProduct: (productId: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  hasPurchasedSubscription: boolean; // New state to track subscription status
};

export const useIapService = (): IapServiceHook => {
  const [products, setProducts] = useState<IapProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasPurchasedSubscription, setHasPurchasedSubscription] = useState<boolean>(false);
  const navigation = useNavigation();

  useEffect(() => {
    // Initialize IAP module on component mount
    const initIap = async () => {
      try {
        await RNIapModule.initConnection();
        // Check for any pending purchases or restored purchases on init
        await RNIapModule.getAvailablePurchases();
        // Check initial subscription status
        await checkSubscriptionStatus();
      } catch (err) {
        if (err instanceof Error) {
          console.error('IAP initialization error:', err.message);
          setError(err);
        } else {
          console.error('Unknown IAP initialization error:', err);
          setError(new Error('Unknown IAP initialization error'));
        }
      }
    };

    initIap();

    // Clean up IAP connection on component unmount
    return () => {
      RNIapModule.endConnection();
    };
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const purchases = await RNIapModule.getAvailablePurchases();
      const subscriptionPurchased = purchases.some((purchase: { productId: string; }) =>
        ['com.example.subscription1', 'com.example.subscription2'].includes(purchase.productId)
      );
      setHasPurchasedSubscription(subscriptionPurchased);
    } catch (err) {
      if (err instanceof Error) {
        console.error('Failed to check subscription status:', err.message);
      } else {
        console.error('Unknown error checking subscription status:', err);
      }
      setHasPurchasedSubscription(false);
    }
  };


  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Replace with your actual product IDs
      const productIds = Platform.select({
        ios: ['com.example.consumable1', 'com.example.subscription1'],
        android: ['com.example.consumable_android1', 'com.example.subscription_android1'],
      });

      if (!productIds) {
        throw new Error('No product IDs defined for this platform.');
      }

      const fetchedProducts: IAPProduct[] = await RNIapModule.getProducts(productIds);

      // Map native IAPProduct to your custom IapProduct type if needed
      const mappedProducts: IapProduct[] = fetchedProducts.map(product => ({
        ...product,
        // Add any custom mapping here, e.g.,
        // localizedTitle: product.localizedTitle || product.title,
        // localizedDescription: product.localizedDescription || product.description,
      }));

      setProducts(mappedProducts);
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error fetching products:', err.message);
        setError(err);
      } else {
        console.error('Unknown error fetching products:', err);
        setError(new Error('Unknown error fetching products'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const purchaseProduct = async (productId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await RNIapModule.requestPurchase(productId);
      // After successful purchase, re-check subscription status
      await checkSubscriptionStatus();
      // Optionally navigate or show a success message
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error purchasing product:', err.message);
        setError(err);
      } else {
        console.error('Unknown error purchasing product:', err);
        setError(new Error('Unknown error purchasing product'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const restored = await RNIapModule.restorePurchases();
      console.log('Restored purchases:', restored);
      // After restoring, re-check subscription status
      await checkSubscriptionStatus();
      // Optionally show a success message or update UI based on restored items
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error restoring purchases:', err.message);
        setError(err);
      } else {
        console.error('Unknown error restoring purchases:', err);
        setError(new Error('Unknown error restoring purchases'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    products,
    fetchProducts,
    purchaseProduct,
    restorePurchases,
    isLoading,
    error,
    hasPurchasedSubscription,
  };
};
