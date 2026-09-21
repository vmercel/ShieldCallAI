
import {
  AuthMethod,
  FirebaseModule,
  FirebaseModuleConfig,
  FirebaseModulePublic,
  AuthError,
  DatabaseModule,
  DatabaseModulePublic,
  AnalyticsModule,
  AuthModule,
  AuthModulePublic,
  AnalyticsModulePublic,
  FirestoreModule,
  FirestoreModulePublic,
  FunctionsModule,
  FunctionsModulePublic,
  MessagingModule,
  MessagingModulePublic,
  StorageModule,
  StorageModulePublic,
  RemoteConfigModule,
  RemoteConfigModulePublic,
  FirebaseFirestoreTypes,
  FirebaseStorageTypes,
  FirebaseFunctionsTypes,
  FirebaseAuthTypes,
  FirebaseDatabaseTypes,
  FirebaseMessagingTypes,
  FirebaseAnalyticsTypes,
  FirebaseRemoteConfigTypes,
} from '../firebase-module';
import {
  NotificationAction,
  NotificationChannel,
  NotificationImportance,
  NotificationVisibility,
  NotificationAndroidVisibility,
} from './notifications';
import { NativeEventEmitter, NativeModules } from 'react-native';

type FirebaseServiceNativeConfig = {
  android?: {
    appId: string;
    apiKey: string;
    databaseURL?: string;
    gaTrackingId?: string;
    gcmSenderID: string;
    projectId: string;
    storageBucket?: string;
  };
  ios?: {
    appId: string;
    apiKey: string;
    bundleId: string;
    clientId: string;
    databaseURL?: string;
    gcmSenderID: string;
    projectId: string;
    storageBucket?: string;
  };
};

type FirebaseNativeModule = {
  initialiseApp: (
    appName: string,
    config: FirebaseServiceNativeConfig,
    options: {
      logLevel: 'debug' | 'info' | 'warn' | 'error' | 'none';
      errorOnMissingPlayServices: boolean;
    }
  ) => Promise<boolean>;
  deleteApp: (appName: string) => Promise<boolean>;
  app: (appName: string) => FirebaseServiceNativeApp;
  apps: () => FirebaseServiceNativeApp[];
  SDK_VERSION: string;
};

type FirebaseServiceNativeApp = {
  name: string;
  options: {
    appId: string;
    apiKey: string;
    bundleId?: string;
    clientId?: string;
    databaseURL?: string;
    gaTrackingId?: string;
    gcmSenderID: string;
    projectId: string;
    storageBucket?: string;
  };
  utils: {
    error: (code: string, message: string) => AuthError;
  };
};

type FirebaseServiceNativeEvent = {
  listenerId: string;
  appName: string;
  body: object;
};

type FirebaseServiceNativeAuth = FirebaseAuthTypes.Module & {
  addListener: (eventName: string, appName: string) => void;
  removeListeners: (eventName: string, appName: string) => void;
};

type FirebaseServiceNativeDatabase = FirebaseDatabaseTypes.Module & {
  addListener: (eventName: string, appName: string, id: string, path: string, queries: object[]) => void;
  removeListeners: (eventName: string, appName: string, id: string) => void;
};

type FirebaseServiceNativeFirestore = FirebaseFirestoreTypes.Module & {
  disableNetwork: (appName: string) => Promise<void>;
  enableNetwork: (appName: string) => Promise<void>;
  /**
   * Clears the persistent storage. This includes any pending writes and cached documents.
   * Note: This method will be deprecated in a future release. Use `clearIndexedDbPersistence` instead.
   */
  clearPersistence: (appName: string) => Promise<void>;
  /**
   * Clears the persistent storage. This includes any pending writes and cached documents.
   */
  clearIndexedDbPersistence: (appName: string) => Promise<void>;
  setLogLevel: (logLevel: 'debug' | 'silent') => void;
  settings: (
    appName: string,
    settings: FirebaseFirestoreTypes.Settings
  ) => Promise<void>;
  transaction: (
    appName: string,
    updateFunction: (
      transaction: FirebaseFirestoreTypes.Transaction
    ) => Promise<any>,
    options?: {
      maxAttempts?: number;
      timeout?: number;
    }
  ) => Promise<any>;
  collection: (
    appName: string,
    collectionPath: string
  ) => FirebaseFirestoreTypes.CollectionReference;
  collectionGroup: (
    appName: string,
    collectionGroupId: string
  ) => FirebaseFirestoreTypes.Query;
  doc: (
    appName: string,
    documentPath: string
  ) => FirebaseFirestoreTypes.DocumentReference;
  getNamedQuery: (appName: string, queryName: string) => Promise<any>;
  batch: (appName: string) => FirebaseFirestoreTypes.WriteBatch;
  addDocumentSnapshotListener: (
    appName: string,
    listenerId: string,
    documentPath: string
  ) => void;
  removeDocumentSnapshotListener: (appName: string, listenerId: string) => void;
  addCollectionSnapshotListener: (
    appName: string,
    listenerId: string,
    collectionPath: string,
    filters: object[],
    orders: object[],
    options: object
  ) => void;
  removeCollectionSnapshotListener: (
    appName: string,
    listenerId: string
  ) => void;
  addCollectionGroupSnapshotListener: (
    appName: string,
    listenerId: string,
    collectionGroupId: string,
    filters: object[],
    orders: object[],
    options: object
  ) => void;
  removeCollectionGroupSnapshotListener: (
    appName: string,
    listenerId: string
  ) => void;
};

type FirebaseServiceNativeFunctions = FirebaseFunctionsTypes.Module & {
  useEmulator: (appName: string, origin: string) => void;
};

type FirebaseServiceNativeMessaging = FirebaseMessagingTypes.Module & {
  hasPermission: (appName: string) => Promise<boolean>;
  deleteToken: (appName: string) => Promise<void>;
  getAPNSToken: (appName: string) => Promise<string | null>;
  getToken: (appName: string) => Promise<string>;
  requestPermission: (appName: string) => Promise<boolean>;
  setBadge: (appName: string, badge: number) => void;
  getBadge: (appName: string) => Promise<number>;
  onMessage: (appName: string, listenerId: string) => void;
  onNotificationOpenedApp: (appName: string, listenerId: string) => void;
  onTokenRefresh: (appName: string, listenerId: string) => void;
  getInitialNotification: (appName: string) => Promise<object | null>;
  sendMessage: (appName: string, message: object) => Promise<string>;
  subscribeToTopic: (appName: string, topic: string) => Promise<void>;
  unsubscribeFromTopic: (appName: string, topic: string) => Promise<void>;
  onDeletedMessages: (appName: string, listenerId: string) => void;
  onMessageSent: (appName: string, listenerId: string) => void;
  onSendError: (appName: string, listenerId: string) => void;
  createChannel: (
    appName: string,
    channel: NotificationChannel
  ) => Promise<void>;
  deleteChannel: (appName: string, channelId: string) => Promise<void>;
  displayNotification: (
    appName: string,
    notification: object
  ) => Promise<void>;
  getChannels: (appName: string) => Promise<NotificationChannel[]>;
  getDeliveredNotifications: (appName: string) => Promise<object[]>;
  getInitialNotificationForAndroid: (appName: string) => Promise<object | null>;
  removeDeliveredNotifications: (
    appName: string,
    notificationIds: string[]
  ) => Promise<void>;
};

type FirebaseServiceNativeStorage = FirebaseStorageTypes.Module & {
  useEmulator: (appName: string, host: string, port: number) => void;
};

type FirebaseServiceNativeAnalytics = FirebaseAnalyticsTypes.Module & {
  logEvent: (appName: string, eventName: string, params?: object) => Promise<void>;
};

type FirebaseServiceNativeRemoteConfig = FirebaseRemoteConfigTypes.Module & {
  setDefaults: (appName: string, defaults: object) => Promise<void>;
  setDefaultsUsingResource: (appName: string, resourceName: string) => Promise<void>;
  fetch: (appName: string, expirationDuration?: number) => Promise<boolean>;
  fetchAndActivate: (appName: string) => Promise<boolean>;
  activate: (appName: string) => Promise<boolean>;
  getAll: (appName: string) => Promise<object>;
  getValue: (appName: string, key: string) => Promise<object>;
  getString: (appName: string, key: string) => Promise<string>;
  getBoolean: (appName: string, key: string) => Promise<boolean>;
  getNumber: (appName: string, key: string) => Promise<number>;
  getByteArray: (appName: string, key: string) => Promise<string>;
};

type FirebaseServiceNativeIAP = {
  // Common
  getConstants: () => {
    PlayStoreModule: string;
    AppStoreModule: string;
    eventNames: {
      iapProcuctsFetch: string;
      iapProcuctsFetchFailed: string;
      iapPurchaseStateChange: string;
      iapPurchaseStateChangeFailed: string;
      iapRestoreCompleted: string;
      iapRestoreFailed: string;
      iapSubscriptionStateChange: string;
      iapSubscriptionStateChangeFailed: string;
    };
  };

  initialize: () => Promise<void>;
  onEvent: (
    eventName: string,
    handler: (data: object) => void
  ) => () => void;

  // Products
  getProducts: (productIds: string[]) => Promise<object[]>;

  // Purchases
  purchaseProduct: (
    productId: string,
    developerPayload?: string
  ) => Promise<void>;
  purchaseSubscription: (
    productId: string,
    developerPayload?: string
  ) => Promise<void>;
  restorePurchases: () => Promise<void>;
};

const FirebaseNative: FirebaseNativeModule = NativeModules.Firebase;
const FirebaseNativeAuth: FirebaseServiceNativeAuth = NativeModules.FirebaseAuth;
const FirebaseNativeDatabase: FirebaseServiceNativeDatabase =
  NativeModules.FirebaseDatabase;
const FirebaseNativeFirestore: FirebaseServiceNativeFirestore =
  NativeModules.FirebaseFirestore;
const FirebaseNativeFunctions: FirebaseServiceNativeFunctions =
  NativeModules.FirebaseFunctions;
const FirebaseNativeMessaging: FirebaseServiceNativeMessaging =
  NativeModules.FirebaseMessaging;
const FirebaseNativeStorage: FirebaseServiceNativeStorage =
  NativeModules.FirebaseStorage;
const FirebaseNativeAnalytics: FirebaseServiceNativeAnalytics =
  NativeModules.FirebaseAnalytics;
const FirebaseNativeRemoteConfig: FirebaseServiceNativeRemoteConfig =
  NativeModules.FirebaseRemoteConfig;

const FirebaseNativeIAP: FirebaseServiceNativeIAP = NativeModules.FirebaseIAP;

const FirebaseNativeEventEmitter = new NativeEventEmitter(
  NativeModules.Firebase
);

// Map firebase-ios-sdk-framework modules to module names
// The keys of this map are module names exposed by the native SDK
const ModuleNameToFirebaseModuleMap = {
  // Core
  Auth: 'Auth',
  Analytics: 'Analytics',
  Database: 'Database',
  Firestore: 'Firestore',
  Functions: 'Functions',
  Messaging: 'Messaging',
  Storage: 'Storage',
  RemoteConfig: 'RemoteConfig',
  IAP: 'IAP',
};

class FirebaseServiceNative extends FirebaseModule {
  constructor(config: FirebaseModuleConfig) {
    super(config);

    if (config.android || config.ios) {
      if (!FirebaseNative.apps().some(app => app.name === config.name)) {
        FirebaseNative.initialiseApp(config.name, config, {
          logLevel: 'error',
          errorOnMissingPlayServices: false,
        });
      }
    }
  }

  app(appName: string) {
    return FirebaseNative.app(appName);
  }

  delete(appName: string) {
    return FirebaseNative.deleteApp(appName);
  }

  apps() {
    return FirebaseNative.apps();
  }

  get auth(): AuthModulePublic {
    return new AuthModule(this, FirebaseNativeAuth, FirebaseNativeEventEmitter);
  }

  get analytics(): AnalyticsModulePublic {
    return new AnalyticsModule(
      this,
      FirebaseNativeAnalytics,
      FirebaseNativeEventEmitter
    );
  }

  get database(): DatabaseModulePublic {
    return new DatabaseModule(
      this,
      FirebaseNativeDatabase,
      FirebaseNativeEventEmitter
    );
  }

  get firestore(): FirestoreModulePublic {
    return new FirestoreModule(
      this,
      FirebaseNativeFirestore,
      FirebaseNativeEventEmitter
    );
  }

  get functions(): FunctionsModulePublic {
    return new FunctionsModule(
      this,
      FirebaseNativeFunctions,
      FirebaseNativeEventEmitter
    );
  }

  get messaging(): MessagingModulePublic {
    return new MessagingModule(
      this,
      FirebaseNativeMessaging,
      FirebaseNativeEventEmitter
    );
  }

  get storage(): StorageModulePublic {
    return new StorageModule(
      this,
      FirebaseNativeStorage,
      FirebaseNativeEventEmitter
    );
  }

  get remoteConfig(): RemoteConfigModulePublic {
    return new RemoteConfigModule(
      this,
      FirebaseNativeRemoteConfig,
      FirebaseNativeEventEmitter
    );
  }

  get iap(): FirebaseServiceNativeIAP {
    return FirebaseNativeIAP;
  }
}

export const Firebase = new FirebaseServiceNative({
  name: '[DEFAULT]',
});
