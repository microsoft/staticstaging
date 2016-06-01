var g = fun f:(Int -> Int) x:Int -> f (f x);
var h = fun x:Int -> x * 2;
g h 3
# -> 12
