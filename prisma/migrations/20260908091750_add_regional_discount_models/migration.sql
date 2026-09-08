-- CreateTable
CREATE TABLE "ShopDiscountSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "discountId" TEXT,
    "discountTitle" TEXT NOT NULL DEFAULT 'Regional State Discount (India)',
    "widgetPosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "bannerMessage" TEXT NOT NULL DEFAULT '🎉 Exclusive regional discounts available! Select your state.',
    "accentColor" TEXT NOT NULL DEFAULT '#2563eb',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StateDiscountRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopSettingId" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" REAL NOT NULL DEFAULT 0,
    "minOrderAmount" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "customMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StateDiscountRule_shopSettingId_fkey" FOREIGN KEY ("shopSettingId") REFERENCES "ShopDiscountSetting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopDiscountSetting_shop_key" ON "ShopDiscountSetting"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "StateDiscountRule_shop_stateCode_key" ON "StateDiscountRule"("shop", "stateCode");
