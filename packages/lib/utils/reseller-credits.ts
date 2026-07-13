export const getNegativeCreditsUsed = (availableCredits: number) => {
  if (availableCredits >= 0) {
    return 0;
  }

  return Math.abs(availableCredits);
};
